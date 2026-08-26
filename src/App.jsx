import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import {
  Bell, Search, LogOut, MessageSquare, BarChart2, Package,
  Pencil, Bot, User, Calendar, Send, X, Check,
  Sparkles, Phone, Mail, Building2, MapPin, FileText,
  AlertCircle, Clock, ChevronDown, ChevronLeft, Zap, ShoppingBag, Shield, Trash2,
  Mic, MicOff, Volume2, VolumeX,
  Copy, Users, TrendingUp, CalendarCheck, RotateCcw, Upload, Settings, UserCheck, Eye, EyeOff, Menu, Star,
  Plus, Image as ImageIcon, Video as VideoIcon, Paperclip, Download, Music, File as FileIcon,
  CornerUpLeft, Pause, Printer,
} from "lucide-react";
import PedidosPanel, { NuevoPedidoModal, imprimirPedido, parseDet, EP } from "./Pedidos";
import {
  supabase, N8N_SEND_WEBHOOK, LOGO_URL, C, L, R, SH, FONT_DISPLAY, FONT_BODY,
  VENDEDORES, ESTADOS, ESTADOS_ACTIVOS, VENDEDORES_INFO, ADMINISTRACION_INFO, calcularAlertas, getRol, limpiarPrecios, getIdentidadInterna,
  construirMensajeMeta, marketingHabilitado,
} from "./lib";
import BotonMensajes from "./MensajeriaInterna";
import NavRail, { NavMobile } from "./NavRail";
import Reportes from "./Reportes";
import AdminPanel from "./AdminPanel";
import VendedorDashboard from "./VendedorPanel";
import AdministracionPanel from "./AdministracionPanel";
import { initPush, initNativo, limpiarPush, esNativo } from "./push";
import { imprimirDoc, descargarDoc } from "./imprimir";
import { docFichaContacto } from "./documentos";
import { conversar, construirSistema, ejecutarHerramienta, claveIA } from "./asistente";
import { avisar, prepararAudio, sonidoActivado, setSonidoActivado, probarSonido } from "./aviso";
const Calendario = lazy(() => import("./Calendario"));
const Marketing = lazy(() => import("./Marketing"));
const Notas = lazy(() => import("./Notas"));

// ============================================================
// HELPERS DE MENSAJES
// ============================================================
// ¿Es una respuesta automática del bot saliente?
const esRespuestaBot = (m) =>
  m.direccion === "out" && (m.origen === "bot" || (!m.origen && !m.agente));

// Ordena cronológicamente; ante el mismo timestamp, el mensaje
// del cliente (entrante) va siempre antes que la respuesta del bot/agente.
const ordenarMensajes = (arr) => {
  const sorted = [...(arr || [])].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    if (a.direccion !== b.direccion) return a.direccion === "in" ? -1 : 1;
    return 0;
  });
  // n8n guarda la respuesta del bot ('out') JUSTO ANTES del mensaje del cliente
  // ('in') que la disparó, dejando al bot adelante por unos milisegundos. Si una
  // respuesta del bot aparece pegada (≤ 6 s) antes de un mensaje del cliente, los
  // intercambiamos para que el cliente quede primero (que es lo real).
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (esRespuestaBot(a) && b.direccion === "in") {
      const gap = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (gap >= 0 && gap <= 6000) { sorted[i] = b; sorted[i + 1] = a; }
    }
  }
  return sorted;
};

// Resuelve la info de medios de un mensaje, tolerando distintos nombres de
// campo (los que use el bot/n8n para imágenes, videos, audios o documentos).
const resolverMedia = (m) => {
  const url = m.media_url || m.mediaUrl || m.imagen || m.image_url || m.url || m.foto || null;
  if (!url || typeof url !== "string") return null;
  let tipo = (m.media_tipo || m.media_type || m.tipo_media || m.tipo || "").toLowerCase();
  if (!["image", "imagen", "video", "audio", "document", "documento", "archivo"].includes(tipo)) {
    const ext = (url.split("?")[0].split(".").pop() || "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) tipo = "image";
    else if (["mp4", "webm", "mov", "avi", "mkv", "3gp"].includes(ext)) tipo = "video";
    else if (["mp3", "ogg", "oga", "wav", "m4a", "aac", "opus"].includes(ext)) tipo = "audio";
    else tipo = "document";
  }
  if (tipo === "imagen") tipo = "image";
  if (tipo === "documento" || tipo === "archivo") tipo = "document";
  return { url, tipo, nombre: m.media_nombre || m.media_name || m.nombre_archivo || "archivo" };
};

// Avatares — colores consistentes por nombre (tonos sobrios)
const AVT = [
  ["#A81F1F","#fff"],["#2A4E8F","#fff"],["#2F6B46","#fff"],
  ["#5B4B8A","#fff"],["#8A5A22","#fff"],["#1F5F6B","#fff"],
  ["#8A3357","#fff"],["#3B4451","#fff"],["#96501F","#fff"],
  ["#2C3E7A","#fff"],
];

// ============================================================
// MOBILE HOOK
// ============================================================
function useIsMobile(bp = 768) {
  const [v, setV] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const h = () => setV(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return v;
}

// Renderiza **negrita** y saltos de línea de las respuestas IA
function renderMd(text) {
  return text.split("\n").map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((p, pi) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={pi}>{p.slice(2, -2)}</strong>
          : p
      )}
    </span>
  ));
}

// ============================================================
// CONTADOR DE ESPERA
// ============================================================
// Mide el tiempo desde que llegó el último mensaje del cliente (`desde`).
// Mientras el chat no se abrió, cuenta en vivo (tic-tac cada segundo) con
// color que escala. Al abrirse el chat se pasa `hasta` (momento de apertura):
// el contador se congela y queda visible como registro de cuánto tardó.
function ContadorEspera({ desde, hasta }) {
  const congelado = !!hasta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (congelado) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [congelado]);
  if (!desde) return null;
  const fin = congelado ? new Date(hasta).getTime() : ahora;
  const ms = fin - new Date(desde).getTime();
  if (ms < 0) return null;
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const txt = h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, "0")}`;

  if (congelado) {
    return (
      <span title={`Atendido en ${txt}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: L.soft, color: L.muted, border: `1px solid ${L.border}`, fontVariantNumeric: "tabular-nums" }}>
        <Check size={11} /> {txt}
      </span>
    );
  }

  const min = totalSeg / 60;
  const col = min < 2 ? { bg: "#DCFCE7", fg: "#15803D", bd: "#86EFAC" }
            : min < 5 ? { bg: "#FEF3C7", fg: "#B45309", bd: "#FDE68A" }
            :           { bg: "#FEE2E2", fg: C.red,     bd: "#FECACA" };
  return (
    <span title="Tiempo de espera sin abrir el chat" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: col.bg, color: col.fg, border: `1px solid ${col.bd}`, fontVariantNumeric: "tabular-nums" }}>
      <Clock size={11} /> {txt}
    </span>
  );
}

// ============================================================
// FONT LOADER
// ============================================================
function FontLoader() {
  useEffect(() => {
    // Las tipografías (Inter / Inter Tight) se empaquetan con la app — sin CDN.
    document.body.style.background = L.bg;
  }, []);
  return null;
}

// ============================================================
// AVATAR
// ============================================================
function Avatar({ nombre, foto, size = 40, border }) {
  const initials = (nombre || "?").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const idx = nombre ? (nombre.charCodeAt(0) * 3 + (nombre.charCodeAt(1) || 0) * 7) % AVT.length : 0;
  const [bg, fg] = AVT[idx];
  if (foto) return (
    <img src={foto} alt={nombre}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: border || `2px solid ${L.border}` }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: Math.round(size * 0.37),
      flexShrink: 0, border: border || `2px solid rgba(255,255,255,.6)`,
      letterSpacing: 0.5, userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function Login() {
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr]       = useState("");
  const [loading, setLoad]  = useState(false);

  const handleLogin = async () => {
    setErr(""); setLoad(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    // Antes cualquier problema decía "email o contraseña incorrectos", así que
    // un usuario sin confirmar o un login deshabilitado parecían un error de
    // tipeo y se perdía tiempo probando contraseñas.
    if (error) {
      const m = (error.message || "").toLowerCase();
      setErr(
        m.includes("not confirmed")   ? "Ese usuario existe, pero le falta confirmar el email. Confirmalo desde Supabase (Authentication → el usuario → Confirm email)."
        : m.includes("disabled")      ? "El ingreso con email está desactivado en Supabase (Authentication → Providers → Email)."
        : m.includes("rate limit") || m.includes("too many") ? "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo."
        : m.includes("failed to fetch") || m.includes("network") ? "No se pudo conectar con el servidor. Revisá la conexión."
        : m.includes("invalid login") ? "Email o contraseña incorrectos."
        : `No se pudo entrar: ${error.message}`
      );
    }
    setLoad(false);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "12px 15px", borderRadius: R.sm, border: `1px solid ${L.border}`, fontSize: 14.5, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.white, transition: "border-color .18s, box-shadow .18s" };

  return (
    <div className="login-scroll" style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: L.bg, fontFamily: FONT_BODY, padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 400, background: L.white, border: `1px solid ${L.border}`, borderRadius: R.xl, boxShadow: SH.md, padding: "34px 32px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <img src={LOGO_URL} alt="Nuevo Munich" style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <div style={{ height: 1, width: 28, background: L.border }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.3em", color: L.light, textTransform: "uppercase" }}>CRM</span>
            <div style={{ height: 1, width: 28, background: L.border }} />
          </div>
        </div>

        {err && (
          <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: C.redSoft, borderRadius: R.sm, border: `1px solid ${C.red}22`, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} /> {err}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: L.muted, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="tu@nuevomunich.com.ar"
            style={inp} autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: L.muted, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
              style={{ ...inp, paddingRight: 46 }} />
            <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex" }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", background: loading ? L.light : C.red, color: "#fff", border: "none", borderRadius: R.sm, padding: "13px", fontSize: 14.5, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: FONT_DISPLAY, letterSpacing: "0.01em", boxShadow: loading ? "none" : SH.sm, transition: "all .18s" }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MOBILE BACK HEADER
// ============================================================
function MobileBack({ title, onBack }) {
  return (
    <div style={{ padding: "11px 16px", background: L.white, borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <button onClick={onBack}
        style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
        <ChevronLeft size={20} />
      </button>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: L.text, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</span>
    </div>
  );
}

// ============================================================
// ALERTAS BTN
// ============================================================
function AlertasBtn({ alertas, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ position: "relative", background: open ? "#FEF2F2" : L.soft, border: `1px solid ${L.border}`, color: open ? C.red : L.muted, borderRadius: 10, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
        <Bell size={17} />
        {alertas.length > 0 && (
          <span style={{ position: "absolute", top: -5, right: -5, background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 10, minWidth: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: `2px solid ${L.white}` }}>
            {alertas.length}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 46, width: 340, maxHeight: 400, overflowY: "auto", background: L.white, borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.15)", border: `1px solid ${L.border}`, zIndex: 100 }}>
          <div style={{ padding: "13px 18px", borderBottom: `1px solid ${L.border}`, fontFamily: FONT_DISPLAY, fontWeight: 600, color: L.text, textTransform: "uppercase", fontSize: 12, letterSpacing: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={14} color={C.red} /> Alertas
            {alertas.length > 0 && <span style={{ background: C.red, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{alertas.length}</span>}
          </div>
          {alertas.length === 0
            ? <div style={{ padding: 24, color: L.muted, fontSize: 14, textAlign: "center" }}>Sin alertas pendientes ✓</div>
            : alertas.map((a) => (
              <div key={a.id} onClick={() => { onSelect(a.contacto); setOpen(false); }}
                style={{ padding: "12px 18px", borderBottom: `1px solid ${L.border}`, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", transition: "background .12s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = L.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {a.tipo === "sin_respuesta" ? "⏰" : a.tipo === "lead_sin_asignar" ? "👤" : "📌"}
                </span>
                <span style={{ fontSize: 13, color: L.text, lineHeight: 1.45 }}>{a.texto}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONTACT DRAWER
// ============================================================
function ContactoDrawer({ contacto, onClose, onSave }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    nombre: contacto.nombre || "", email: contacto.email || "",
    empresa: contacto.empresa || "", direccion: contacto.direccion || "",
    nota_seguimiento: contacto.nota_seguimiento || "",
  });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [err, setErr]             = useState("");
  const [esVend, setEsVend]       = useState(!!contacto.es_vendedor);
  const [toggling, setToggling]   = useState(false);
  const [generandoFicha, setGenerandoFicha] = useState(false);

  // La ficha lleva el historial de pedidos del cliente: se busca recién al
  // imprimir/descargar, así el drawer no carga datos que no siempre hacen falta.
  const fichaContacto = async (accion) => {
    setGenerandoFicha(true);
    const { data } = await supabase.from("pedidos").select("*").eq("contacto_id", contacto.id);
    const doc = docFichaContacto(contacto, data || [], parseDet);
    const nombre = `ficha-${(contacto.nombre || contacto.telefono || "cliente").toLowerCase()}.pdf`;
    if (accion === "imprimir") imprimirDoc(doc, nombre); else descargarDoc(doc, nombre);
    setGenerandoFicha(false);
  };

  const toggleVendedor = async () => {
    setToggling(true);
    const nuevoVal = !esVend;
    await supabase.from("contactos").update({ es_vendedor: nuevoVal }).eq("id", contacto.id);
    setEsVend(nuevoVal);
    onSave({ ...contacto, ...form, es_vendedor: nuevoVal });
    setToggling(false);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setErr("");
    // El nombre se guarda limpio: si queda vacío va como null para que el
    // nombre del perfil de WhatsApp vuelva a completarlo. Si tiene texto,
    // manda sobre el de WhatsApp y queda registrado para siempre.
    const datos = { ...form, nombre: form.nombre.trim() || null };
    const { error } = await supabase.from("contactos").update(datos).eq("id", contacto.id);
    if (error) {
      if (error.code === "PGRST204" || (error.message && error.message.includes("column"))) {
        const { error: e2 } = await supabase.from("contactos")
          .update({ nombre: datos.nombre, nota_seguimiento: datos.nota_seguimiento }).eq("id", contacto.id);
        if (!e2) { onSave({ ...contacto, nombre: datos.nombre, nota_seguimiento: datos.nota_seguimiento }); setSaved(true); setTimeout(() => setSaved(false), 2500); }
        else setErr("Ejecutá la migración en supabase_schema.sql para guardar todos los campos.");
      } else setErr("Error: " + error.message);
    } else {
      onSave({ ...contacto, ...datos }); setSaved(true); setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const inputSt = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 9, border: `1px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.soft };
  const labelSt = { display: "block", fontSize: 11, color: L.muted, marginBottom: 6, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };
  const fields = [
    { label: "Nombre completo", key: "nombre", icon: <User size={14} />, type: "text", ph: "Ej: Juan García" },
    { label: "Email", key: "email", icon: <Mail size={14} />, type: "email", ph: "juan@empresa.com" },
    { label: "Empresa", key: "empresa", icon: <Building2 size={14} />, type: "text", ph: "Nombre de la empresa" },
    { label: "Dirección", key: "direccion", icon: <MapPin size={14} />, type: "text", ph: "Calle, Ciudad, Provincia" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, paddingTop: "env(safe-area-inset-top)", width: isMobile ? "100%" : 390, background: L.white, boxShadow: "-6px 0 40px rgba(0,0,0,.18)", zIndex: 201, display: "flex", flexDirection: "column", fontFamily: FONT_BODY }}>
        {/* Header */}
        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={52} border={`1px solid ${L.border}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: L.text }}>{contacto.nombre || "Nuevo contacto"}</div>
            <div style={{ fontSize: 12.5, color: L.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              <Phone size={12} /> {contacto.telefono}
            </div>
          </div>
          <button onClick={() => fichaContacto("imprimir")} disabled={generandoFicha} title="Imprimir ficha del cliente"
            style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: generandoFicha ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
            <Printer size={16} />
          </button>
          <button onClick={() => fichaContacto("descargar")} disabled={generandoFicha} title="Descargar ficha en PDF"
            style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: generandoFicha ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
            <Download size={16} />
          </button>
          <button onClick={onClose} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "22px" }}>
          <div style={{ fontSize: 11, color: L.light, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 18, paddingBottom: 10, borderBottom: `1px solid ${L.border}` }}>
            Datos del contacto
          </div>
          {fields.map(({ label, key, icon, type, ph }) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <label style={labelSt}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{icon} {label}</span></label>
              <input type={type} value={form[key]} onChange={set(key)} placeholder={ph} style={inputSt} />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FileText size={14} /> Notas internas</span></label>
            <textarea value={form.nota_seguimiento} onChange={set("nota_seguimiento")}
              placeholder="Notas, preferencias, observaciones sobre el contacto..."
              rows={4} style={{ ...inputSt, resize: "vertical", lineHeight: 1.55 }} />
          </div>
          {/* Toggle Es Vendedor */}
          <div style={{ marginBottom: 18, padding: "13px 16px", background: esVend ? "#DCFCE7" : L.soft, borderRadius: 10, border: `1px solid ${esVend ? "#86EFAC" : L.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all .2s" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: esVend ? "#15803D" : L.muted, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                <UserCheck size={13} /> Es Vendedor / Interno
              </div>
              <div style={{ fontSize: 11, color: L.muted, marginTop: 3 }}>
                {esVend ? "Sus mensajes aparecen en la pestaña Vendedores" : "Activar si este contacto es un vendedor del equipo"}
              </div>
            </div>
            <button onClick={toggleVendedor} disabled={toggling}
              style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", cursor: toggling ? "default" : "pointer", background: esVend ? "#16A34A" : L.border, position: "relative", transition: "background .2s" }}>
              <div style={{ position: "absolute", top: 3, left: esVend ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.2)", transition: "left .2s" }} />
            </button>
          </div>

          <div style={{ padding: "13px 16px", background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Teléfono WhatsApp</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: L.text }}>{contacto.telefono}</div>
            <div style={{ fontSize: 11, color: L.muted, marginTop: 2 }}>No editable — identificador único</div>
          </div>
          {err && <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 500, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={15} /> {err}
          </div>}
        </div>
        {/* Footer */}
        <div style={{ padding: "16px 22px", borderTop: `1px solid ${L.border}`, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${L.border}`, color: L.muted, borderRadius: 9, padding: 11, fontSize: 14, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, background: saved ? "#16A34A" : C.red, color: "#fff", border: "none", borderRadius: 9, padding: 11, fontSize: 14, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.5, opacity: saving ? 0.75 : 1, transition: "background .3s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saved ? <><Check size={16} /> Guardado</> : saving ? "Guardando…" : "Guardar Contacto"}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ASISTENTE IA
// ============================================================
// ============================================================
// AVISOS EN VIVO
// ============================================================
// Con la app abierta, Android no muestra ni hace sonar las push:
// las entrega calladas. Así que el aviso con la app en pantalla lo
// damos nosotros — suena, vibra y aparece un cartel — escuchando
// Supabase en tiempo real. Y esto también cubre la web de escritorio
// y el iPhone, donde no hay push nativas.
function AvisosEnVivo({ userEmail, rol, contactos, onAbrirContacto, onIrA }) {
  const [avisos, setAvisos] = useState([]);
  const isMobile = useIsMobile();
  const contactosRef = useRef(contactos);
  useEffect(() => { contactosRef.current = contactos; }, [contactos]);

  const mostrar = useCallback((aviso) => {
    setAvisos((p) => [...p.slice(-2), { ...aviso, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const cerrar = useCallback((id) => {
    setAvisos((p) => p.filter((a) => a.id !== id));
  }, []);

  // Los carteles se van solos a los 7 segundos.
  useEffect(() => {
    if (!avisos.length) return;
    const t = setTimeout(() => setAvisos((p) => p.slice(1)), 7000);
    return () => clearTimeout(t);
  }, [avisos]);

  useEffect(() => {
    if (!userEmail) return;
    prepararAudio();

    const miKey    = getIdentidadInterna(userEmail).key;
    const miAlias  = VENDEDORES_INFO.find((v) => v.emailPrefix === miKey)?.alias || null;
    const veTodo   = rol === "admin" || rol === "administracion";

    // ── Mensaje de WhatsApp de un cliente ──
    const canal = supabase.channel("avisos-en-vivo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, ({ new: m }) => {
        if (m.direccion !== "in") return;   // sólo lo que entra del cliente

        const c = contactosRef.current.find((x) => x.id === m.contacto_id);
        // Un vendedor sólo se entera de sus propios clientes.
        if (!veTodo && miAlias && c?.vendedor !== miAlias) return;

        // La clave va por cliente y no por mensaje: así el aviso que llega por
        // Supabase y el que llega por la push se reconocen como el mismo.
        if (!avisar(`wa-${m.contacto_id}`, "mensaje")) return;
        mostrar({
          tipo: "mensaje",
          titulo: c?.nombre || c?.telefono || "Cliente nuevo",
          texto: String(m.contenido || "").slice(0, 110) || "Te mandó un archivo",
          contactoId: m.contacto_id,
        });
      })
      // ── Mensaje interno de un compañero ──
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes_internos" }, ({ new: m }) => {
        if (m.para_key !== miKey) return;
        if (!avisar(`int-${m.de_key}`, "mensaje")) return;
        mostrar({
          tipo: "interno",
          titulo: m.de_nombre || "Mensaje interno",
          texto: String(m.texto || "").slice(0, 110),
        });
      })
      // ── Pedido nuevo (sólo para quienes los gestionan) ──
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, ({ new: p }) => {
        if (!veTodo) return;
        if (!avisar(`ped-${p.id}`, "pedido")) return;
        const c = contactosRef.current.find((x) => x.id === p.contacto_id);
        mostrar({
          tipo: "pedido",
          titulo: "Pedido nuevo",
          texto: `${c?.nombre || "Cliente"} · ${p.vendedor || "sin vendedor"}`,
          vista: "pedidos",
        });
      })
      .subscribe();

    // En el APK, una push que llega con la app abierta no se muestra sola:
    // Capacitor nos la pasa por acá y le damos el mismo trato.
    const desdePush = (e) => {
      const n = e.detail || {};
      const clave = n.data?.contacto_id ? `wa-${n.data.contacto_id}`
        : n.data?.de_key ? `int-${n.data.de_key}`
        : n.data?.pedido_id ? `ped-${n.data.pedido_id}`
        : `push-${Date.now()}`;
      if (!avisar(clave, n.data?.tipo === "pedido" ? "pedido" : "mensaje")) return;
      mostrar({
        tipo: n.data?.tipo === "pedido" ? "pedido" : "mensaje",
        titulo: n.title || "Nuevo Munich",
        texto: n.body || "",
        contactoId: n.data?.contacto_id,
        vista: n.data?.vista,
      });
    };
    window.addEventListener("push:en-primer-plano", desdePush);

    return () => {
      supabase.removeChannel(canal);
      window.removeEventListener("push:en-primer-plano", desdePush);
    };
  }, [userEmail, rol, mostrar]);

  if (!avisos.length) return null;

  const COLOR = {
    mensaje: { borde: "#25D366", Icon: MessageSquare },
    interno: { borde: "#2A4E8F", Icon: Users },
    pedido:  { borde: C.gold,    Icon: ShoppingBag },
  };

  return (
    <div style={{
      position: "fixed", zIndex: 350, display: "flex", flexDirection: "column", gap: 8,
      ...(isMobile
        ? { top: "calc(10px + env(safe-area-inset-top))", left: 10, right: 10 }
        : { bottom: 24, left: 24, width: 340 }),
    }}>
      {avisos.map((a) => {
        const { borde, Icon } = COLOR[a.tipo] || COLOR.mensaje;
        const clickeable = !!(a.contactoId || a.vista);
        return (
          <div key={a.id} className="muni-burbuja"
            onClick={() => {
              if (a.contactoId) onAbrirContacto?.(a.contactoId);
              else if (a.vista) onIrA?.(a.vista);
              cerrar(a.id);
            }}
            style={{
              display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 13px",
              background: L.white, borderRadius: R.md, border: `1px solid ${L.border}`,
              borderLeft: `3px solid ${borde}`, boxShadow: SH.lg,
              cursor: clickeable ? "pointer" : "default", fontFamily: FONT_BODY,
            }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${borde}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={16} color={borde} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.titulo}
              </div>
              <div style={{ fontSize: 12.5, color: L.muted, marginTop: 2, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {a.texto}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); cerrar(a.id); }} title="Cerrar"
              style={{ background: "none", border: "none", cursor: "pointer", color: L.light, padding: 2, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AIAsistente({ contactoActivo, onActualizarContacto, userName, userEmail }) {
  const isMobile = useIsMobile();
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([{ from: "ai", bienvenida: true, text: "", time: new Date().toISOString() }]);
  const [input, setInput]     = useState("");
  const [typing, setTyping]   = useState(false);
  const [actividad, setActividad]     = useState("");   // qué está haciendo ahora mismo
  const [recording, setRecording]     = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceOn, setVoiceOn]         = useState(false);
  const [copiedId, setCopiedId]       = useState(null);
  const [enviando, setEnviando]       = useState(null);  // clave de la propuesta que se está mandando
  const voiceOnRef        = useRef(false);
  const voiceRef          = useRef(null);
  const currentAudioRef   = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const chunksRef         = useRef([]);
  const bottomRef         = useRef(null);

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open, actividad]);

  // Cargar la mejor voz disponible (async — los navegadores las cargan tarde)
  useEffect(() => {
    const pickVoice = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      const priority = [
        (v) => /elena/i.test(v.name) && v.lang.startsWith("es"),   // Microsoft Elena (Edge)
        (v) => /latinoam[eé]rica/i.test(v.name),
        (v) => /sabina|helena|monica|jorge|pablo/i.test(v.name) && v.lang.startsWith("es"),
        (v) => v.lang === "es-AR",
        (v) => v.lang === "es-419",
        (v) => v.lang === "es-MX",
        (v) => v.lang === "es-US",
        (v) => v.lang.startsWith("es-"),
        (v) => v.lang.startsWith("es"),
      ];
      for (const fn of priority) {
        const found = voices.find(fn);
        if (found) { voiceRef.current = found; break; }
      }
    };
    pickVoice();
    window.speechSynthesis?.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", pickVoice);
  }, []);

  // Animaciones propias del asistente
  useEffect(() => {
    const id = "muni-anim";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(168,31,31,.5)}50%{box-shadow:0 0 0 8px rgba(168,31,31,0)}}
@keyframes muniIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes muniBurbuja{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes muniPunto{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}
@keyframes muniBrillo{0%,100%{opacity:.55}50%{opacity:1}}
.muni-panel{animation:muniIn .22s cubic-bezier(.16,1,.3,1)}
.muni-burbuja{animation:muniBurbuja .2s ease-out}
.muni-punto{display:inline-block;width:5px;height:5px;border-radius:50%;background:${C.red};animation:muniPunto 1.1s infinite}
.muni-chips::-webkit-scrollbar{display:none}
.muni-chips{scrollbar-width:none}`;
      document.head.appendChild(s);
    }
  }, []);

  const speak = useCallback(async (text) => {
    if (!voiceOnRef.current) return;

    // Detener cualquier audio previo
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    const clean = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[*•#\[\]]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .slice(0, 700);

    const azureKey    = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const azureRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || "brazilsouth";

    if (azureKey) {
      try {
        const ssml = `<speak version='1.0' xml:lang='es-AR'><voice name='es-AR-ElenaNeural'><prosody rate='0%' pitch='+3%'>${clean}</prosody></voice></speak>`;
        const res = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
          },
          body: ssml,
        });
        if (res.ok) {
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.play();
          audio.onended = () => { URL.revokeObjectURL(url); currentAudioRef.current = null; };
          return;
        }
      } catch (e) {
        console.error("Azure TTS:", e);
      }
    }

    // Fallback: SpeechSynthesis del browser
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "es-AR"; utt.rate = 1.0; utt.pitch = 1.08; utt.volume = 1;
    if (voiceRef.current) utt.voice = voiceRef.current;
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Conversación ────────────────────────────────────────────
  // Muni contesta y, si hace falta, opera el CRM por su cuenta.
  const enviar = useCallback(async (textoOverride) => {
    const q = (textoOverride ?? input).trim();
    if (!q || typing) return;

    const propios = [...msgs, { from: "user", text: q, time: new Date().toISOString() }];
    setMsgs(propios);
    if (!textoOverride) setInput("");
    setTyping(true);
    setActividad("");
    const inicio = Date.now();

    try {
      // Un resumen corto va siempre en el prompt para que las preguntas
      // simples se contesten sin gastar una vuelta de herramientas.
      let datos = null;
      try {
        ({ datos } = await ejecutarHerramienta("metricas", { dias: 7 }, { parse: parseDet }));
      } catch { /* si la base no contesta, Muni igual puede charlar */ }

      const resumen = !datos ? "(no pude leer los números en este momento)" : [
        `• Contactos: ${datos.contactos_totales} (nuevos hoy: ${datos.nuevos_hoy}, esta semana: ${datos.nuevos_periodo})`,
        `• Pipeline: ${Object.entries(datos.pipeline).map(([e, n]) => `${e} (${n})`).join(" · ")}`,
        `• Sin responder: ${datos.sin_responder}`,
        `• Últimos 7 días: ${datos.pedidos_periodo} pedidos · $${datos.facturacion_periodo.toLocaleString("es-AR")} · ${datos.mensajes_recibidos} mensajes recibidos`,
        datos.ranking_vendedores.length
          ? `• Vendedores: ${datos.ranking_vendedores.map((v) => `${v.vendedor} ${v.pedidos}`).join(" · ")}`
          : "• Todavía nadie cargó pedidos esta semana",
      ].join("\n");

      const historial = propios
        .filter((m) => !m.bienvenida && m.text)
        .slice(-6)
        .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));

      const { texto, acciones, propuestas, contactoActualizado } = await conversar({
        historial,
        sistema: construirSistema({ userName, contactoActivo, resumen }),
        ctx: { parse: parseDet, userEmail },
        onAccion: (a) => setActividad(a.resumen),
      });

      if (contactoActualizado && contactoActivo?.id === contactoActualizado.id) {
        onActualizarContacto?.({ ...contactoActivo, ...contactoActualizado });
      }

      setMsgs((p) => [...p, {
        from: "ai", text: texto, acciones, propuestas,
        time: new Date().toISOString(),
        responseTime: ((Date.now() - inicio) / 1000).toFixed(1),
      }]);
      speak(texto);
    } catch (e) {
      setMsgs((p) => [...p, {
        from: "ai", error: true,
        text: `Uh, se me cortó: ${e.message}`,
        time: new Date().toISOString(),
      }]);
    }
    setActividad("");
    setTyping(false);
  }, [input, typing, msgs, contactoActivo, onActualizarContacto, speak, userName, userEmail]);

  // Manda de verdad una propuesta de WhatsApp: primero al CRM, después a n8n.
  const enviarPropuesta = useCallback(async (prop, clave) => {
    if (enviando) return;
    setEnviando(clave);
    try {
      await supabase.from("mensajes").insert({
        contacto_id: prop.contacto.id, direccion: "out", origen: "agente",
        agente: userName || "Muni", contenido: prop.texto,
      });
      if (N8N_SEND_WEBHOOK) {
        await fetch(N8N_SEND_WEBHOOK, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // `meta` es lo que reenvía n8n; los campos sueltos quedan por si
            // el workflow todavía es el viejo.
            meta: construirMensajeMeta({
              telefono: prop.contacto.telefono,
              mensaje: `*${userName || "Nuevo Munich"}:*\n${prop.texto}`,
            }),
            telefono: prop.contacto.telefono,
            mensaje: `*${userName || "Nuevo Munich"}:*\n${prop.texto}`,
            agente: userName || "Muni",
          }),
        });
      }
      setMsgs((p) => p.map((m) => ({
        ...m,
        propuestas: m.propuestas?.map((x) => (x === prop ? { ...x, enviado: true } : x)),
      })));
    } catch {
      setMsgs((p) => p.map((m) => ({
        ...m,
        propuestas: m.propuestas?.map((x) => (x === prop ? { ...x, fallo: true } : x)),
      })));
    }
    setEnviando(null);
  }, [enviando, userName]);

  const toggleMic = useCallback(() => {
    // Detener grabación en curso
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Tu navegador no soporta grabación de audio.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      chunksRef.current = [];

      // Elegir el mejor formato soportado por el dispositivo
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(
        (t) => MediaRecorder.isTypeSupported(t)
      ) || "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) return;

        setTranscribing(true);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "").includes("mp4") ? "m4a" : "webm";

        try {
          const formData = new FormData();
          formData.append("file", blob, `audio.${ext}`);
          formData.append("model", "whisper-large-v3");
          formData.append("language", "es");
          formData.append("response_format", "json");

          const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${claveIA()}` },
            body: formData,
          });
          const json = await res.json();
          const transcript = json.text?.trim();
          if (transcript) {
            setInput(transcript);
            // Si el usuario mandó audio, la respuesta también sale con voz
            setVoiceOn(true);
            voiceOnRef.current = true;
            setTimeout(() => enviar(transcript), 50);
          }
        } catch (err) {
          console.error("Whisper error:", err);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    }).catch(() => {
      alert("No se pudo acceder al micrófono. Verificá los permisos del navegador.");
    });
  }, [recording, enviar]);

  // Atajos: cambian según haya o no un cliente abierto.
  const atajos = contactoActivo
    ? [
        { icon: MessageSquare, label: "Escribirle",        q: `Escribile un mensaje a ${contactoActivo.nombre || "este cliente"} para retomar la conversación` },
        { icon: CalendarCheck, label: "Seguimiento",       q: "Agendale un seguimiento en 2 días" },
        { icon: Check,         label: "Marcar vendido",    q: "Pasá este cliente a vendido" },
        { icon: ShoppingBag,   label: "Cargar pedido",     q: "Quiero cargarle un pedido a este cliente" },
        { icon: FileText,      label: "Resumen del cliente", q: "Contame todo de este cliente: qué compró y de qué hablamos" },
      ]
    : [
        { icon: TrendingUp,    label: "Cómo venimos",      q: "¿Cómo venimos esta semana? Dame lo importante" },
        { icon: Users,         label: "Sin responder",     q: "¿Qué clientes escribieron y todavía nadie contestó?" },
        { icon: Calendar,      label: "Agenda",            q: "¿Qué tengo agendado los próximos días?" },
        { icon: Package,       label: "Últimos pedidos",   q: "Mostrame los pedidos de los últimos 7 días" },
        { icon: Zap,           label: "Dónde enfocarme",   q: "Mirá los números y decime dónde conviene que ponga el foco hoy" },
      ];

  const avatarMuni = (size = 32) => (
    <div style={{
      width: size, height: size, borderRadius: size * 0.34, flexShrink: 0,
      background: `linear-gradient(140deg, ${C.red} 0%, ${C.redDark} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 3px 10px rgba(168,31,31,.28)",
    }}>
      <Sparkles size={size * 0.46} color="#fff" />
    </div>
  );

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setOpen((v) => !v)} title="Muni · tu asistente"
        style={{ position: "fixed", bottom: isMobile ? "calc(96px + env(safe-area-inset-bottom))" : 150, right: isMobile ? 16 : 24, width: isMobile ? 52 : 58, height: isMobile ? 52 : 58, borderRadius: "50%", background: open ? L.white : `linear-gradient(140deg, ${C.red} 0%, ${C.redDark} 100%)`, border: open ? `1px solid ${L.border}` : "none", color: open ? C.red : "#fff", cursor: "pointer", boxShadow: open ? SH.md : "0 8px 24px rgba(168,31,31,.38)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .18s, box-shadow .18s" }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.07)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
        {open ? <X size={22} /> : <Sparkles size={24} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="muni-panel" style={{ position: "fixed", bottom: isMobile ? "calc(104px + env(safe-area-inset-bottom))" : 156, right: isMobile ? 12 : 24, ...(isMobile ? { left: 12 } : { width: 440 }), height: isMobile ? "76dvh" : "min(660px, calc(100vh - 130px))", maxHeight: isMobile ? "calc(100% - 90px)" : "calc(100vh - 130px)", background: L.white, borderRadius: R.xl, boxShadow: SH.xl, border: `1px solid ${L.border}`, zIndex: 299, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_BODY }}>

        {/* ── Cabecera ── */}
        <div style={{ background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDark} 100%)`, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: 0.2, lineHeight: 1.15 }}>Muni</div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.82)", marginTop: 2, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: typing ? "#FCD34D" : "#4ADE80", flexShrink: 0, animation: typing ? "muniBrillo 1s infinite" : "none" }} />
              {typing ? (actividad || "pensando…") : contactoActivo ? `viendo a ${contactoActivo.nombre || contactoActivo.telefono}` : "tu asistente, listo"}
            </div>
          </div>
          <button onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? "Silenciar voz" : "Que me hable"}
            style={{ background: voiceOn ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {voiceOn ? <Volume2 size={15} color="#fff" /> : <VolumeX size={15} color="rgba(255,255,255,.7)" />}
          </button>
          {msgs.length > 1 && (
            <button onClick={() => { setMsgs([msgs[0]]); setInput(""); }} title="Empezar de nuevo"
              style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <RotateCcw size={14} color="rgba(255,255,255,.85)" />
            </button>
          )}
          <button onClick={() => setOpen(false)} title="Cerrar"
            style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} color="#fff" />
          </button>
        </div>

        {/* ── Mensajes ── */}
        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14, background: C.cream }}>
          {msgs.map((m, i) => (
            <div key={i}>
              {/* Bienvenida */}
              {m.bienvenida ? (
                <div className="muni-burbuja" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "18px 10px 6px" }}>
                  {avatarMuni(52)}
                  <div>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: L.text }}>
                      Hola{userName ? `, ${userName.split(" ")[0]}` : ""} 👋
                    </div>
                    <div style={{ fontSize: 13.5, color: L.muted, marginTop: 6, lineHeight: 1.55, maxWidth: 320 }}>
                      Soy <strong>Muni</strong>. Preguntame lo que quieras o pedime que haga cosas en el CRM:
                      cambiar estados, cargar pedidos, agendar, escribirle a un cliente. Lo hago yo.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                  <div className="muni-burbuja" style={{ display: "flex", alignItems: "flex-start", gap: 9, maxWidth: "92%" }}>
                    {m.from === "ai" && avatarMuni(30)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ padding: "11px 14px", borderRadius: m.from === "user" ? `${R.lg}px ${R.xs}px ${R.lg}px ${R.lg}px` : `${R.xs}px ${R.lg}px ${R.lg}px ${R.lg}px`, background: m.from === "user" ? C.red : m.error ? "#FEF2F2" : L.white, color: m.from === "user" ? "#fff" : m.error ? "#B42318" : L.text, fontSize: 13.5, lineHeight: 1.6, boxShadow: SH.xs, border: m.from === "user" ? "none" : `1px solid ${m.error ? "#FECDCA" : L.border}` }}>
                        {renderMd(m.text)}
                      </div>

                      {/* Lo que Muni hizo de verdad en el CRM */}
                      {!!m.acciones?.length && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                          {m.acciones.map((a, ai) => (
                            <div key={ai} style={{ display: "flex", alignItems: "center", gap: 7, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", borderRadius: R.sm, padding: "6px 10px", fontSize: 12, fontWeight: 500 }}>
                              <Check size={13} style={{ flexShrink: 0 }} />
                              <span style={{ minWidth: 0 }}>{a.resumen}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mensajes de WhatsApp propuestos: no salen hasta que los aprobás */}
                      {m.propuestas?.map((prop, pi) => {
                        const clave = `${i}-${pi}`;
                        return (
                          <div key={pi} style={{ marginTop: 9, background: L.white, border: `1px solid ${L.border}`, borderLeft: `3px solid #25D366`, borderRadius: R.md, padding: "11px 13px", boxShadow: SH.xs }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: L.muted, fontFamily: FONT_DISPLAY, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 7 }}>
                              Para {prop.contacto.nombre || prop.contacto.telefono}
                            </div>
                            <div style={{ fontSize: 13.2, color: L.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{prop.texto}</div>
                            <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                              {prop.enviado ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803D", fontSize: 12.5, fontWeight: 600 }}>
                                  <Check size={14} /> Enviado
                                </span>
                              ) : (
                                <>
                                  <button onClick={() => enviarPropuesta(prop, clave)} disabled={!!enviando}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#25D366", border: "none", color: "#fff", borderRadius: R.sm, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: FONT_BODY, cursor: enviando ? "wait" : "pointer" }}>
                                    <Send size={14} /> {enviando === clave ? "Enviando…" : "Enviar por WhatsApp"}
                                  </button>
                                  <button onClick={() => { navigator.clipboard?.writeText(prop.texto); setCopiedId(clave); setTimeout(() => setCopiedId(null), 1500); }}
                                    title="Copiar el mensaje"
                                    style={{ background: L.soft, border: `1px solid ${L.border}`, color: L.muted, borderRadius: R.sm, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                    {copiedId === clave ? <Check size={14} color="#15803D" /> : <Copy size={14} />}
                                  </button>
                                </>
                              )}
                            </div>
                            {prop.fallo && (
                              <div style={{ marginTop: 8, fontSize: 11.5, color: "#B42318" }}>
                                No se pudo enviar. Probá desde el chat del cliente.
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Pie: hora, demora y copiar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, paddingLeft: 2, fontSize: 10.5, color: L.light }}>
                        <span>{m.time ? new Date(m.time).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        {m.responseTime && <span>· {m.responseTime}s</span>}
                        {m.from === "ai" && !m.error && (
                          <button onClick={() => { navigator.clipboard?.writeText(m.text.replace(/\*\*([^*]+)\*\*/g, "$1")); setCopiedId(i); setTimeout(() => setCopiedId(null), 1500); }}
                            title="Copiar respuesta"
                            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: copiedId === i ? "#15803D" : L.light, fontSize: 10.5, padding: 0 }}>
                            {copiedId === i ? <Check size={11} /> : <Copy size={11} />}
                            {copiedId === i ? "Copiado" : "Copiar"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Muni pensando / trabajando */}
          {typing && (
            <div className="muni-burbuja" style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {avatarMuni(30)}
              <div style={{ padding: "10px 14px", background: L.white, borderRadius: `${R.xs}px ${R.lg}px ${R.lg}px ${R.lg}px`, border: `1px solid ${L.border}`, boxShadow: SH.xs, display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ display: "flex", gap: 3 }}>
                  <span className="muni-punto" />
                  <span className="muni-punto" style={{ animationDelay: ".15s" }} />
                  <span className="muni-punto" style={{ animationDelay: ".3s" }} />
                </span>
                {actividad && <span style={{ fontSize: 12, color: L.muted }}>{actividad}</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Atajos ── */}
        {!typing && (
          <div className="muni-chips" style={{ display: "flex", gap: 7, padding: "10px 14px 0", overflowX: "auto", flexShrink: 0, background: L.white }}>
            {atajos.map(({ icon: Icon, label, q }) => (
              <button key={label} onClick={() => enviar(q)}
                style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: L.white, border: `1px solid ${L.border}`, borderRadius: R.pill, padding: "7px 13px", fontSize: 12.2, fontWeight: 600, color: L.muted, fontFamily: FONT_BODY, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; e.currentTarget.style.background = C.redSoft; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.muted; e.currentTarget.style.background = L.white; }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Escribir ── */}
        <div style={{ padding: "10px 14px 12px", display: "flex", gap: 8, background: L.white, alignItems: "flex-end", flexShrink: 0 }}>
          <button onClick={toggleMic} disabled={transcribing} title={recording ? "Listo" : "Hablar"}
            style={{ background: recording ? C.redSoft : transcribing ? "#FFF7ED" : L.soft, border: `1px solid ${recording ? C.red : transcribing ? "#F97316" : L.border}`, borderRadius: R.pill, width: 42, height: 42, cursor: transcribing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: recording ? "micPulse 1.2s ease-in-out infinite" : "none" }}>
            {transcribing
              ? <span style={{ fontSize: 13, fontWeight: 700, color: "#F97316", letterSpacing: 2 }}>···</span>
              : recording ? <MicOff size={17} color={C.red} /> : <Mic size={17} color={L.muted} />}
          </button>
          <textarea value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={transcribing ? "Procesando el audio…" : recording ? "Te escucho… tocá para parar" : "Escribime o pedime algo…"}
            rows={1}
            style={{ flex: 1, padding: "11px 16px", borderRadius: R.lg, border: `1px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, outline: "none", color: L.text, background: L.soft, resize: "none", lineHeight: 1.5, maxHeight: 110, overflowY: "auto" }} />
          <button onClick={() => enviar()} disabled={typing || !input.trim()}
            title="Enviar"
            style={{ background: typing || !input.trim() ? L.border : `linear-gradient(140deg, ${C.red} 0%, ${C.redDark} 100%)`, border: "none", color: "#fff", borderRadius: R.pill, width: 42, height: 42, cursor: typing || !input.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: typing || !input.trim() ? "none" : "0 4px 12px rgba(168,31,31,.3)" }}>
            <Send size={17} />
          </button>
        </div>
      </div>
      )}
    </>
  );
}

// ============================================================
// IMPORTAR CONTACTOS MODAL
// ============================================================
function ImportarContactosModal({ onClose }) {
  const [fase, setFase] = useState("drop");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [contactosParsed, setContactosParsed] = useState([]);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef(null);

  function cleanPhone(p) {
    return String(p).replace(/\D/g, "").replace(/^0/, "");
  }

  function detectDelimiter(line) {
    const counts = { ",": 0, ";": 0, "\t": 0 };
    for (const ch of line) if (ch in counts) counts[ch]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function parseLine(line, delim) {
    const result = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) {
        result.push(cur.trim()); cur = "";
      } else cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const delim = detectDelimiter(lines[0]);
    const headers = parseLine(lines[0], delim).map(h => h.toLowerCase().replace(/['"]/g, "").trim());
    const patterns = {
      telefono: ["telefono","phone","tel","whatsapp","celular","movil","móvil","numero","número","nro","cel"],
      nombre:   ["nombre","name","contacto","contact","cliente"],
      empresa:  ["empresa","company","org","organización","organizacion","negocio","razon","razón"],
      email:    ["email","correo","mail"],
      vendedor: ["vendedor","seller","agente","asesor"],
    };
    const map = {};
    headers.forEach((h, i) => {
      for (const [field, ps] of Object.entries(patterns)) {
        if (map[field] === undefined && ps.some(p => h.includes(p))) map[field] = i;
      }
    });
    if (map.telefono === undefined) map.telefono = 0;
    return lines.slice(1).map(line => {
      const vals = parseLine(line, delim);
      const phone = cleanPhone(vals[map.telefono] || "");
      if (!phone || phone.length < 7) return null;
      return {
        telefono: phone,
        nombre:   map.nombre   !== undefined ? (vals[map.nombre]   || "") : "",
        empresa:  map.empresa  !== undefined ? (vals[map.empresa]  || "") : "",
        email:    map.email    !== undefined ? (vals[map.email]    || "") : "",
        vendedor: map.vendedor !== undefined ? (vals[map.vendedor] || "") : "",
      };
    }).filter(Boolean);
  }

  function parseVCF(text) {
    const contacts = [];
    for (const block of text.split(/BEGIN:VCARD/i).slice(1)) {
      let nombre = "", telefono = "", empresa = "", email = "";
      for (const line of block.split(/\r?\n/)) {
        const sep = line.indexOf(":");
        if (sep < 0) continue;
        const key = line.slice(0, sep).toUpperCase();
        const val = line.slice(sep + 1).trim();
        if (key === "FN") nombre = val;
        else if (key.startsWith("TEL") && !telefono) telefono = cleanPhone(val);
        else if (key === "ORG" && !empresa) empresa = val.split(";")[0].trim();
        else if (key.startsWith("EMAIL") && !email) email = val;
        else if (key === "N" && !nombre) {
          const p = val.split(";");
          nombre = [p[1], p[0]].filter(Boolean).join(" ").trim();
        }
      }
      if (telefono && telefono.length >= 7)
        contacts.push({ telefono, nombre, empresa, email, vendedor: "" });
    }
    return contacts;
  }

  async function handleFile(file) {
    setCargando(true);
    setError("");
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop().toLowerCase();
      let parsed = [];
      if (ext === "vcf" || ext === "vcard") parsed = parseVCF(text);
      else if (["csv","txt","tsv"].includes(ext)) parsed = parseCSV(text);
      else { setError("Formato no soportado. Usá CSV o VCF."); setCargando(false); return; }
      if (parsed.length === 0) { setError("No se encontraron contactos válidos en el archivo."); setCargando(false); return; }
      setContactosParsed(parsed);
      setFase("preview");
    } catch (e) {
      setError("Error al leer el archivo: " + e.message);
    } finally {
      setCargando(false);
    }
  }

  async function importar() {
    setCargando(true);
    setError("");
    try {
      // Deduplicar dentro del archivo (mismo teléfono en múltiples filas)
      const seen = new Set();
      const deduped = contactosParsed.filter(c => {
        if (seen.has(c.telefono)) return false;
        seen.add(c.telefono);
        return true;
      });
      const omitidosDup = contactosParsed.length - deduped.length;

      // Upsert: si el teléfono ya existe en DB, ignorar (no sobreescribir)
      for (let i = 0; i < deduped.length; i += 50) {
        const { error: e } = await supabase.from("contactos").upsert(
          deduped.slice(i, i + 50).map(c => ({
            telefono: c.telefono,
            nombre:   c.nombre   || null,
            empresa:  c.empresa  || null,
            email:    c.email    || null,
            vendedor: c.vendedor || null,
            estado: "nuevo", bot_activo: false, no_leidos: 0,
          })),
          { onConflict: "telefono", ignoreDuplicates: true }
        );
        if (e) throw e;
      }
      setResultado({ creados: deduped.length, omitidos: omitidosDup });
      setFase("done");
    } catch (e) {
      setError("Error al importar: " + (e.message || String(e)));
    } finally {
      setCargando(false);
    }
  }

  function descargarPlantilla() {
    const csv = "telefono,nombre,empresa,email\n5491112345678,Juan García,Restaurante El Comedor,juan@ejemplo.com\n5493512345678,María López,,\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla_contactos.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(520px, 95vw)", maxHeight: "88vh", background: L.white, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", zIndex: 301, display: "flex", flexDirection: "column", fontFamily: FONT_BODY }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={20} color="#1D4ED8" />
          </div>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text }}>Importar contactos</div>
            <div style={{ fontSize: 12, color: L.muted, marginTop: 1 }}>CSV, TSV o VCF (exportación del celular)</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: L.soft, border: `1px solid ${L.border}`, borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {fase === "drop" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                style={{ border: `2px dashed ${L.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: L.soft, transition: "border-color .15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.red}
                onMouseLeave={e => e.currentTarget.style.borderColor = L.border}>
                <Upload size={32} color={L.light} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 700, color: L.text, fontSize: 14.5, marginBottom: 6 }}>
                  {cargando ? "Leyendo archivo…" : "Hacé clic o arrastrá el archivo acá"}
                </div>
                <div style={{ fontSize: 12.5, color: L.muted }}>CSV · TSV · VCF (contactos del celular)</div>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.vcf,.vcard" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </div>

              {error && (
                <div style={{ marginTop: 14, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>{error}</div>
              )}

              <div style={{ marginTop: 18, padding: "14px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={18} color="#16A34A" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#15803D" }}>¿No tenés el archivo listo?</div>
                  <div style={{ fontSize: 12, color: "#4ADE80", marginTop: 2 }}>Descargá la plantilla, completala en Excel o Google Sheets e importala.</div>
                </div>
                <button onClick={descargarPlantilla} style={{ flexShrink: 0, padding: "7px 14px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Plantilla
                </button>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, color: L.light, lineHeight: 1.7 }}>
                <strong style={{ color: L.muted }}>Columnas CSV reconocidas:</strong> telefono, nombre, empresa, email, vendedor.<br />
                <strong style={{ color: L.muted }}>Exportar del celular (VCF):</strong> Contactos → Ajustes → Exportar → guardar como .vcf.<br />
                <strong style={{ color: L.muted }}>Excel / Sheets:</strong> Archivo → Guardar como → CSV (.csv) antes de importar.
              </div>
            </>
          )}

          {fase === "preview" && (
            <>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 700, color: L.text, fontSize: 15 }}>{contactosParsed.length}</span>
                  <span style={{ color: L.muted, fontSize: 13.5 }}> contactos encontrados</span>
                </div>
                <button onClick={() => { setFase("drop"); setContactosParsed([]); setError(""); }}
                  style={{ fontSize: 12.5, color: C.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Cambiar archivo
                </button>
              </div>

              <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${L.border}`, marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: L.soft }}>
                      {["Teléfono", "Nombre", "Empresa"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: L.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${L.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contactosParsed.slice(0, 8).map((c, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${L.border}` }}>
                        <td style={{ padding: "8px 12px", color: L.text, fontFamily: "monospace", fontSize: 12 }}>{c.telefono}</td>
                        <td style={{ padding: "8px 12px", color: L.text }}>{c.nombre || <span style={{ color: L.light, fontStyle: "italic" }}>—</span>}</td>
                        <td style={{ padding: "8px 12px", color: L.muted }}>{c.empresa || <span style={{ color: L.light, fontStyle: "italic" }}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contactosParsed.length > 8 && (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: L.light, textAlign: "center", borderTop: `1px solid ${L.border}` }}>
                    +{contactosParsed.length - 8} más…
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>{error}</div>
              )}

              <div style={{ fontSize: 12.5, color: L.muted, padding: "10px 14px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
                Los contactos con el mismo número de teléfono serán omitidos automáticamente.
              </div>
            </>
          )}

          {fase === "done" && resultado && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Check size={28} color="#16A34A" />
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: L.text, marginBottom: 8 }}>
                ¡Importación completada!
              </div>
              <div style={{ fontSize: 14, color: L.muted, marginBottom: 24, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: "#16A34A", fontSize: 18 }}>{resultado.creados}</span> contactos nuevos importados
                {resultado.omitidos > 0 && <><br /><span style={{ fontWeight: 600 }}>{resultado.omitidos}</span> omitidos (ya existían)</>}
              </div>
              <button onClick={onClose} style={{ padding: "11px 32px", background: C.red, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT_DISPLAY, letterSpacing: 0.4 }}>
                Ver contactos
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {fase === "preview" && (
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${L.border}`, display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "10px 22px", background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, fontSize: 13.5, color: L.muted, cursor: "pointer", fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={importar} disabled={cargando}
              style={{ padding: "10px 22px", background: cargando ? L.light : C.red, color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: cargando ? "not-allowed" : "pointer", fontFamily: FONT_DISPLAY, letterSpacing: 0.3 }}>
              {cargando ? "Importando…" : `Importar ${contactosParsed.length} contactos`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
// ============================================================
// AJUSTES PANEL
// ============================================================
function AjustesPanel({ userName, userEmail, rol }) {
  const [showImportar, setShowImportar] = useState(false);
  const [sonido, setSonido] = useState(sonidoActivado());

  const card = { background: L.white, border: `1px solid ${L.border}`, borderRadius: 14, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.04)" };
  const sTitle = { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 };

  return (
    <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: L.bg, maxWidth: 660, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: L.text, margin: "0 0 24px", letterSpacing: 0.3 }}>Ajustes</h1>

      {/* ── Perfil ── */}
      <div style={card}>
        <div style={sTitle}><User size={15} color={C.red} /> Mi Perfil</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 22, color: "#fff", flexShrink: 0 }}>
            {(userName || "U")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: L.text, marginBottom: 4 }}>{userName}</div>
            <div style={{ fontSize: 13, color: L.muted, marginBottom: 6 }}>{userEmail}</div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: rol === "admin" ? "#FEF2F2" : "#EFF6FF", color: rol === "admin" ? C.red : "#1D4ED8", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {rol === "admin" ? "Administrador" : "Vendedor"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Avisos ── */}
      <div style={card}>
        <div style={sTitle}><Bell size={15} color={C.red} /> Avisos y sonido</div>
        <p style={{ fontSize: 13.5, color: L.muted, margin: "0 0 18px", lineHeight: 1.6 }}>
          Cuando entra un mensaje de un cliente, un mensaje interno o un pedido nuevo,
          el CRM hace sonar el aparato y muestra un cartel. Con la app cerrada avisa igual
          por las notificaciones del celular.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => { const v = !sonido; setSonido(v); setSonidoActivado(v); if (v) probarSonido(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: 10, border: `1px solid ${sonido ? C.red : L.border}`, background: sonido ? "#FEF2F2" : L.white, color: sonido ? C.red : L.muted, fontSize: 13.5, fontWeight: 700, fontFamily: FONT_BODY, cursor: "pointer" }}>
            {sonido ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {sonido ? "Sonido activado" : "Sonido silenciado"}
          </button>
          <button onClick={probarSonido}
            style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${L.border}`, background: L.white, color: L.muted, fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}>
            Probar sonido
          </button>
        </div>
      </div>

      {/* ── Importar Contactos ── */}
      <div style={card}>
        <div style={sTitle}><Upload size={15} color={C.red} /> Importar Contactos</div>
        <p style={{ fontSize: 13.5, color: L.muted, margin: "0 0 18px", lineHeight: 1.6 }}>
          Cargá contactos masivamente desde un archivo exportado de tu celular o de una planilla.
          Formatos soportados: <strong>CSV</strong>, <strong>TSV</strong>, <strong>VCF</strong> (vCard).
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {[["📱 VCF", "Exportá contactos de tu celular (Android/iPhone)"],
            ["📊 CSV", "Planilla con columnas: teléfono, nombre, empresa, email, vendedor"],
          ].map(([fmt, desc]) => (
            <div key={fmt} style={{ flex: 1, minWidth: 200, background: L.soft, border: `1px solid ${L.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: L.text, marginBottom: 4 }}>{fmt}</div>
              <div style={{ fontSize: 12, color: L.muted }}>{desc}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowImportar(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.red, color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 14, fontWeight: 700, fontFamily: FONT_DISPLAY, cursor: "pointer", letterSpacing: 0.3, transition: "all .15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#7a1212"}
          onMouseLeave={e => e.currentTarget.style.background = C.red}>
          <Upload size={17} /> Seleccionar archivo e importar
        </button>
      </div>

      {/* ── Info app ── */}
      <div style={card}>
        <div style={sTitle}><Shield size={15} color={C.red} /> Acerca de</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[["CRM", "Nuevo Munich CRM"], ["Base de datos", "Supabase"], ["Mensajería", "WhatsApp vía n8n"]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: L.light, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13.5, color: L.text, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {showImportar && <ImportarContactosModal onClose={() => setShowImportar(false)} />}
    </div>
  );
}

// Título mostrado en la cabecera del panel lateral según la vista activa
const TITULO_VISTA = {
  chat: "Chats", vendedores: "Vendedores", pedidos: "Pedidos", calendario: "Calendario",
  contactos: "Contactos", reportes: "Reportes", ajustes: "Ajustes", admin: "Admin",
  marketing: "Marketing", notas: "Notas",
};

function Sidebar({ contactos, activo, onSelect, onToggleDestacado, onLogout, userEmail, userName, vista, setVista, alertas, isMobile, rol }) {
  const [filtro, setFiltro]           = useState("todos");
  const [soloDestacados, setSoloDestacados] = useState(false);
  const [busqueda, setBusqueda]       = useState("");
  const [showImportar, setShowImportar] = useState(false);

  // Detecta si un contacto ES un vendedor (no solo asignado a uno)
  // Chequea: flag manual es_vendedor, nombre exacto/parcial, o alias al inicio
  const esVendedorContacto = (c) => {
    if (c.es_vendedor === true) return true;
    const n = (c.nombre || "").toLowerCase().trim();
    if (!n) return false;
    return VENDEDORES_INFO.some(v => {
      const alias = v.alias.toLowerCase();
      const nombre = v.nombre.toLowerCase();
      return (
        n === alias ||
        n === nombre ||
        n.startsWith(alias + " ") ||
        n.startsWith(alias) ||
        nombre.split(" ").some(p => p.length >= 4 && n.includes(p))
      );
    });
  };

  // Chat solo muestra contactos que ya tuvieron actividad de WhatsApp
  const tieneConversacion = (c) => !!(c.ultimo_msg || c.ultimo_in_at || c.ultimo_out_at);

  const baseContactos =
    vista === "vendedores" ? contactos.filter(c => esVendedorContacto(c) && tieneConversacion(c)) :
    vista === "chat"       ? contactos.filter(c => tieneConversacion(c) && !esVendedorContacto(c)) :
    contactos; // "contactos" muestra todos

  const lista = baseContactos
    .filter((c) => {
      const porEstado = filtro === "todos" || c.estado === filtro;
      const porBusq   = !busqueda || (c.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || c.telefono.includes(busqueda);
      const porDest   = !soloDestacados || c.destacado;
      return porEstado && porBusq && porDest;
    })
    // Los destacados (importantes) siempre arriba, respetando el orden por fecha
    .sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));

  return (
    <div style={{ width: "100%", height: "100%", background: L.white, borderRight: `1px solid ${L.border}`, boxShadow: "6px 0 28px rgba(16,24,40,.05)", display: "flex", flexDirection: "column", position: "relative", zIndex: 3 }}>

      {/* ── Cabecera compacta: marca + acciones ── */}
      <div style={{ padding: "9px 12px 9px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${L.border}`, background: L.white, flexShrink: 0 }}>
        {/* En desktop el logo vive en el rail; acá sólo hace falta en mobile */}
        {isMobile && <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 46, objectFit: "contain", maxWidth: 168, filter: "drop-shadow(0 2px 6px rgba(16,24,40,.12))" }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 750, fontSize: 13, letterSpacing: 0.9, textTransform: "uppercase", color: L.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {TITULO_VISTA[vista] || "Chats"}
          </div>
          <div style={{ fontSize: 11, color: L.light, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* En desktop el chat interno vive en el menú lateral */}
          {isMobile && userEmail && <BotonMensajes self={getIdentidadInterna(userEmail)} compact />}
          <AlertasBtn alertas={alertas} onSelect={(c) => { setVista("chat"); onSelect(c); }} />
        </div>
      </div>

      {(vista === "chat" || vista === "contactos") && (
        <>
          {/* ── Búsqueda ── */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${L.border}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={vista === "contactos" ? "Buscar contacto…" : "Buscar conversación…"}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
              {/* Botón importar solo en pestaña Contactos */}
              {vista === "contactos" && (
                <button onClick={() => setShowImportar(true)} title="Importar contactos desde CSV o VCF"
                  style={{ flexShrink: 0, height: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: L.soft, border: `1px solid ${L.border}`, borderRadius: 10, cursor: "pointer", color: L.muted, transition: "all .15s", padding: "0 11px", fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#1D4ED8"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.muted; }}>
                  <Upload size={14} /> Importar
                </button>
              )}
            </div>
          </div>

          {/* ── Filtro estado (desplegable) + importantes ── */}
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${L.border}`, display: "flex", gap: 8, alignItems: "center" }}>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: `1px solid ${filtro !== "todos" ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, fontWeight: 700, color: filtro !== "todos" ? C.red : L.muted, background: L.white, cursor: "pointer", outline: "none" }}>
              <option value="todos">Todos los estados</option>
              {ESTADOS_ACTIVOS.map((f) => (
                <option key={f} value={f}>{ESTADOS[f]?.label || f}</option>
              ))}
            </select>
            <button onClick={() => setSoloDestacados(v => !v)}
              title={soloDestacados ? "Mostrar todos" : "Mostrar solo importantes"}
              style={{ flexShrink: 0, height: 34, display: "flex", alignItems: "center", gap: 5, padding: "0 11px", borderRadius: 8, border: `1px solid ${soloDestacados ? "#F59E0B" : L.border}`, background: soloDestacados ? "#FFFBEB" : L.white, color: soloDestacados ? "#B45309" : L.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY, whiteSpace: "nowrap", outline: "none" }}>
              <Star size={14} fill={soloDestacados ? "#F59E0B" : "none"} color={soloDestacados ? "#F59E0B" : L.muted} /> Importantes
            </button>
          </div>

          {/* ── Lista contactos ── */}
          <div className="scroll-y" style={{ overflowY: "auto", flex: 1, paddingBottom: isMobile ? "calc(66px + env(safe-area-inset-bottom))" : 8 }}>
            {lista.length === 0 && (
              <div style={{ padding: 36, color: L.light, fontSize: 13.5, textAlign: "center" }}>
                {busqueda ? "Sin resultados" : vista === "chat" ? "Sin conversaciones activas" : "Sin contactos"}
              </div>
            )}
            {lista.map((c) => {
              const est  = ESTADOS[c.estado] || ESTADOS.nuevo;
              const sel  = activo?.id === c.id;
              const hora = c.updated_at ? (() => {
                const d = new Date(c.updated_at);
                const hoy = new Date();
                const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
                const mismoAnio = d.getFullYear() === hoy.getFullYear();
                if (d.toDateString() === hoy.toDateString()) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                if (d.toDateString() === ayer.toDateString()) return "Ayer";
                return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", ...(mismoAnio ? {} : { year: "2-digit" }) });
              })() : "";
              return (
                <div key={c.id} onClick={() => onSelect(c)}
                  style={{
                    position: "relative", padding: "13px 14px", margin: "3px 9px", borderRadius: R.md,
                    cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
                    background: sel ? L.white : "transparent",
                    // El divisor va como sombra interna: así el estado seleccionado
                    // puede escalar sin que la fila cambie de alto.
                    boxShadow: sel
                      ? `0 10px 30px rgba(16,24,40,.13), 0 2px 8px rgba(16,24,40,.07), inset 0 0 0 1px ${C.red}22`
                      : `inset 0 -1px 0 ${L.border}`,
                    transform: sel ? "scale(1.045)" : "scale(1)",
                    zIndex: sel ? 2 : 1, willChange: "transform",
                    transition: "transform .24s cubic-bezier(.22,1,.36,1), box-shadow .24s ease, background .16s ease",
                  }}
                  onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.background = L.soft; e.currentTarget.style.transform = "scale(1.008)"; } }}
                  onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; } }}>
                  {/* Acento lateral que crece al seleccionar */}
                  <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 4, height: sel ? "66%" : 0, background: C.red, borderRadius: "0 4px 4px 0", boxShadow: sel ? `0 0 12px ${C.red}66` : "none", opacity: sel ? 1 : 0, transition: "height .24s cubic-bezier(.22,1,.36,1), opacity .18s ease" }} />
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar nombre={c.nombre || c.telefono} foto={c.foto_url} size={46} />
                    {!c.bot_activo && (
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 13, height: 13, borderRadius: "50%", background: "#F59E0B", border: `2px solid ${L.white}` }} title="Atendido por agente" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: L.text, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%" }}>
                        {c.nombre || c.telefono}
                      </span>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleDestacado?.(c); }}
                          title={c.destacado ? "Quitar de importantes" : "Marcar como importante"}
                          style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer", display: "flex", alignItems: "center", lineHeight: 0 }}>
                          <Star size={15}
                            fill={c.destacado ? "#F59E0B" : "none"}
                            color={c.destacado ? "#F59E0B" : L.light} />
                        </button>
                        <span style={{ fontSize: 11, color: L.light }}>{hora}</span>
                        {c.no_leidos > 0 && (
                          <span style={{ background: "#22C55E", color: "#fff", fontSize: 10, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", fontWeight: 800 }}>{c.no_leidos}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: L.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>
                      {limpiarPrecios(c.ultimo_msg) || (c.empresa ? `🏢 ${c.empresa}` : c.email ? `✉ ${c.email}` : "Sin mensajes aún")}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                      {c.no_leidos > 0
                        ? <ContadorEspera desde={c.ultimo_in_at || c.updated_at} />
                        : (c.leido_at && c.ultimo_in_at && new Date(c.leido_at) > new Date(c.ultimo_in_at))
                          ? <ContadorEspera desde={c.ultimo_in_at} hasta={c.leido_at} />
                          : null}
                      <span style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 4, background: est.bg, color: est.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{est.label}</span>
                      {c.es_vendedor && <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 4, background: "#DCFCE7", color: "#15803D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Vendedor</span>}
                      {!c.es_vendedor && c.vendedor && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{c.vendedor}</span>}
                      {c.seguimiento_at && new Date(c.seguimiento_at) <= new Date() && <span title="Seguimiento vencido"><Clock size={12} color={C.red} /></span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {(vista === "reportes" || vista === "vendedores" || vista === "pedidos" || vista === "calendario") && <div style={{ flex: 1 }} />}

      {showImportar && <ImportarContactosModal onClose={() => setShowImportar(false)} />}
    </div>
  );
}

// ============================================================
// CHAT PANEL
// ============================================================
function ChatPanel({ contacto, onUpdateContacto, userName, onBack, isMobile, onEliminar, rol }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto]       = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [err, setErr]             = useState("");
  const [panelSeg, setPanelSeg]   = useState(false);
  const [drawer, setDrawer]       = useState(false);
  const [pedidoModal, setPedido]  = useState(false);
  const [msgParaPedido, setMsgParaPedido] = useState(null);
  const [hoverMsg, setHoverMsg]   = useState(null);
  const [newMsgIds, setNewMsgIds] = useState(new Set());
  const [menuAdjuntar, setMenuAdjuntar] = useState(false);
  const [subiendo, setSubiendo]   = useState(false);
  const [replyTo, setReplyTo]     = useState(null);   // mensaje al que se responde (estilo WhatsApp)
  const [pedidoOk, setPedidoOk]   = useState(false);  // confirmación "Agregar a pedidos"
  const [agregandoPed, setAgregandoPed] = useState(false);
  const endRef = useRef(null);
  const fileImagenRef   = useRef(null);
  const fileVideoRef    = useRef(null);
  const fileDocRef      = useRef(null);

  useEffect(() => {
    const id = "msg-new-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        @keyframes msgSlideIn{0%{opacity:0;transform:translateX(-14px)}70%{transform:translateX(3px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes msgGlow{0%{box-shadow:0 0 0 0 rgba(156,27,27,.45),0 1px 4px rgba(0,0,0,.07)}65%{box-shadow:0 0 0 8px rgba(156,27,27,0),0 1px 4px rgba(0,0,0,.07)}100%{box-shadow:0 1px 4px rgba(0,0,0,.07)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .9s linear infinite}
      `;
      document.head.appendChild(s);
    }
  }, []);

  const eliminarMensaje = async (id) => {
    if (!window.confirm("¿Eliminar este mensaje del CRM?")) return;
    await supabase.from("mensajes").delete().eq("id", id);
    setMensajes((prev) => prev.filter((m) => m.id !== id));
  };

  const marcarComoPedido = async (contenido) => {
    const detalle = JSON.stringify({ items: [{ desc: contenido, qty: 1, precio: 0 }], notas: "", entrega: "Retiro en local", direccion: contacto.direccion || "", pago: "Efectivo" });
    await supabase.from("pedidos").insert({ contacto_id: contacto.id, vendedor: contacto.vendedor || "", detalle, total: 0, estado: "pendiente" });
  };

  // Autor legible de un mensaje (para la cita estilo WhatsApp)
  const autorDe = (m) => {
    if (m.direccion === "in") return contacto.nombre || contacto.telefono || "Cliente";
    if (m.origen === "agente") return m.agente || "Agente";
    if (m.origen === "bot" || (m.direccion === "out" && !m.origen && !m.agente)) return "Bot · Nuevo Munich";
    return "Nuevo Munich";
  };
  // Resumen corto de un mensaje (texto o etiqueta de medio)
  const snippetDe = (m) => {
    const media = resolverMedia(m);
    const txt = limpiarPrecios(m.contenido || m.body || m.message || m.texto) || "";
    if (txt) return txt;
    if (media) return media.tipo === "image" ? "📷 Imagen" : media.tipo === "video" ? "🎥 Video" : media.tipo === "audio" ? "🎤 Audio" : "📎 " + (media.nombre || "Documento");
    return "Mensaje";
  };

  // "Agregar a pedidos" → crea el pedido y lo manda directo a Administración
  const agregarAPedido = async () => {
    if (agregandoPed) return;
    setAgregandoPed(true); setErr("");
    const ultimosMsgs = mensajes.filter((m) => m.direccion === "in").slice(-5);
    const desc = ultimosMsgs.length > 0
      ? ultimosMsgs.map((m) => snippetDe(m)).join("\n")
      : `Pedido de ${contacto.nombre || contacto.telefono}`;
    const detalle = JSON.stringify({ items: [{ desc, qty: 1, precio: 0 }], notas: "Generado desde el chat", entrega: "Retiro en local", direccion: contacto.direccion || "", pago: "Efectivo" });
    const { error } = await supabase.from("pedidos").insert({
      contacto_id: contacto.id, vendedor: contacto.vendedor || "", detalle, total: 0, estado: "pendiente",
    });
    if (error) { setErr("No se pudo agregar a pedidos: " + error.message); setAgregandoPed(false); return; }
    // Marcar el contacto como pedido para reflejarlo en el estado
    if (contacto.estado !== "pedido") {
      await supabase.from("contactos").update({ estado: "pedido" }).eq("id", contacto.id);
      onUpdateContacto({ ...contacto, estado: "pedido" });
    }
    setAgregandoPed(false);
    setPedidoOk(true);
    setTimeout(() => setPedidoOk(false), 2500);
  };

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("mensajes").select("*").eq("contacto_id", contacto.id).order("created_at", { ascending: true });
    setMensajes(ordenarMensajes(data || []));
    // Solo Administración resetea contadores y marca el mensaje como visto. Si abre
    // otro rol (p. ej. Cristian/admin) el chat se lee sin tocar no_leidos ni leido_at.
    if (rol === "administracion") {
      await supabase.from("contactos").update({ no_leidos: 0 }).eq("id", contacto.id);
      // Si había mensajes sin leer, congelamos el momento de apertura para dejar
      // registrado cuánto tardó en atenderse (update aparte: si la columna leido_at
      // todavía no existe, no rompe el reseteo de no_leidos de arriba).
      if ((contacto.no_leidos || 0) > 0) {
        const leidoAt = new Date().toISOString();
        await supabase.from("contactos").update({ leido_at: leidoAt }).eq("id", contacto.id);
        // Reflejarlo ya en la lista de chats sin esperar al realtime: se apaga el
        // globo verde de no leídos y el cronómetro se congela en el acto.
        onUpdateContacto({ ...contacto, no_leidos: 0, leido_at: leidoAt });
      } else if (contacto.no_leidos !== 0) {
        onUpdateContacto({ ...contacto, no_leidos: 0 });
      }
    }
  }, [contacto.id, rol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`msg-${contacto.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `contacto_id=eq.${contacto.id}` },
        (p) => {
          setMensajes((m) => m.some((x) => x.id === p.new.id) ? m : ordenarMensajes([...m, p.new]));
          if (p.new.direccion === "in" || p.new.origen === "bot" || p.new.origen === "n8n") {
            setNewMsgIds((s) => new Set([...s, p.new.id]));
            setTimeout(() => setNewMsgIds((s) => { const n = new Set(s); n.delete(p.new.id); return n; }), 2500);
          }
          // Si el mensaje entra con el chat abierto en Administración ya está
          // leído: no debe volver a arrancar el cronómetro ni el globo verde.
          if (p.new.direccion === "in" && rol === "administracion") {
            supabase.from("contactos").update({ no_leidos: 0, leido_at: new Date().toISOString() }).eq("id", contacto.id).then(() => {});
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [contacto.id, cargar]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true); setErr(""); setTexto("");
    const cita = replyTo ? { texto: snippetDe(replyTo).slice(0, 220), autor: autorDe(replyTo) } : null;
    setReplyTo(null);

    // 1) Guardar en CRM (Supabase)
    const { data, error } = await supabase.from("mensajes").insert({
      contacto_id: contacto.id, direccion: "out", origen: "agente", agente: userName, contenido: cuerpo,
      cita_texto: cita?.texto || null, cita_autor: cita?.autor || null,
    }).select().single();
    if (error) {
      setErr("Error al guardar el mensaje: " + error.message);
      setTexto(cuerpo);
      setEnviando(false);
      return;
    }
    if (data) {
      setMensajes((prev) => [...prev, data]);
    }

    // 2) Enviar por WhatsApp vía n8n (no bloquea si falla)
    if (N8N_SEND_WEBHOOK) {
      try {
        const citaWA = cita ? `↩️ _${cita.autor}: ${cita.texto}_\n\n` : "";
        const msgWA = `${citaWA}*${userName} · Nuevo Munich:*\n${cuerpo}`;
        const res = await fetch(N8N_SEND_WEBHOOK, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meta: construirMensajeMeta({ telefono: contacto.telefono, mensaje: msgWA }),
            telefono: contacto.telefono, mensaje: msgWA, agente: userName,
          }),
        });
        if (!res.ok) {
          setErr("Mensaje guardado en CRM, pero falló el envío por WhatsApp.");
        } else {
          setMensajes((prev) => [...prev, {
            id: `n8n-${Date.now()}`, contacto_id: contacto.id, direccion: "out", origen: "n8n", agente: userName,
            contenido: "Mensaje enviado por WhatsApp vía n8n.", created_at: new Date().toISOString(),
          }] );
        }
      } catch {
        setErr("Mensaje guardado en CRM, pero no se pudo conectar con WhatsApp.");
      }
    }

    setEnviando(false);
  };

  // Tamaño máximo por archivo (16 MB, límite de WhatsApp)
  const MAX_MB = 16;

  const subirArchivo = async (file, tipo) => {
    setMenuAdjuntar(false);
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`El archivo supera el máximo de ${MAX_MB} MB.`);
      return;
    }
    setErr(""); setSubiendo(true);
    try {
      // 1) Subir a Supabase Storage (bucket público "chat-media")
      const ext  = (file.name.split(".").pop() || "bin").toLowerCase();
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
      const path = `${contacto.id}/${Date.now()}-${safe || "archivo." + ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) { setErr("Error al subir el archivo: " + upErr.message); setSubiendo(false); return; }

      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      const mediaUrl = pub?.publicUrl;

      // 2) Guardar el mensaje en el CRM con la referencia al medio
      const caption = texto.trim();
      const cita = replyTo ? { texto: snippetDe(replyTo).slice(0, 220), autor: autorDe(replyTo) } : null;
      setReplyTo(null);
      const { data, error } = await supabase.from("mensajes").insert({
        contacto_id: contacto.id, direccion: "out", origen: "agente", agente: userName,
        contenido: caption, media_url: mediaUrl, media_tipo: tipo, media_nombre: file.name,
        cita_texto: cita?.texto || null, cita_autor: cita?.autor || null,
      }).select().single();
      if (error) { setErr("Archivo subido, pero no se pudo guardar el mensaje: " + error.message); setSubiendo(false); return; }
      if (data) setMensajes((prev) => ordenarMensajes([...prev, data]));
      setTexto("");

      // 3) Enviar por WhatsApp vía n8n (no bloquea si falla)
      if (N8N_SEND_WEBHOOK) {
        try {
          const citaWA = cita ? `↩️ _${cita.autor}: ${cita.texto}_\n\n` : "";
          await fetch(N8N_SEND_WEBHOOK, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meta: construirMensajeMeta({
                telefono: contacto.telefono,
                mensaje: caption ? `${citaWA}*${userName} · Nuevo Munich:*\n${caption}` : citaWA,
                mediaUrl, mediaTipo: tipo, mediaNombre: file.name,
              }),
              telefono: contacto.telefono, agente: userName,
              mensaje: caption ? `${citaWA}*${userName} · Nuevo Munich:*\n${caption}` : citaWA,
              media_url: mediaUrl, media_tipo: tipo, media_nombre: file.name,
            }),
          });
        } catch { /* el medio ya quedó guardado en el CRM */ }
      }
    } catch (e) {
      setErr("No se pudo subir el archivo: " + (e?.message || e));
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarChat = async () => {
    if (!window.confirm(`¿Eliminar el chat de ${contacto.nombre || contacto.telefono} y todos sus mensajes? Esta acción no se puede deshacer.`)) return;
    await supabase.from("mensajes").delete().eq("contacto_id", contacto.id);
    await supabase.from("pedidos").delete().eq("contacto_id", contacto.id);
    await supabase.from("contactos").delete().eq("id", contacto.id);
    onEliminar?.();
  };

  const upd = async (campos) => {
    await supabase.from("contactos").update(campos).eq("id", contacto.id);
    onUpdateContacto({ ...contacto, ...campos });
    // Si cambia estado a "pedido", crear pedido automático con los últimos mensajes del cliente
    if (campos.estado === "pedido") {
      const ultimosMsgs = mensajes.filter((m) => m.direccion === "in").slice(-3);
      if (ultimosMsgs.length > 0) {
        const desc = ultimosMsgs.map((m) => m.contenido).join("\n");
        const detalle = JSON.stringify({ items: [{ desc, qty: 1, precio: 0 }], notas: "", entrega: "Retiro en local", direccion: contacto.direccion || "", pago: "Efectivo" });
        await supabase.from("pedidos").insert({ contacto_id: contacto.id, vendedor: contacto.vendedor || campos.vendedor || "", detalle, total: 0, estado: "pendiente" });
      }
    }
  };

  const est = ESTADOS[contacto.estado] || ESTADOS.nuevo;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: L.bg, overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? "10px 14px" : "12px 22px", borderBottom: `1px solid ${L.border}`, background: L.white, boxShadow: SH.sm, flexShrink: 0, position: "relative", zIndex: 2 }}>
        {/* Fila 1: contacto info */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
          {isMobile && onBack && (
            <button onClick={onBack}
              style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={isMobile ? 38 : 48} border={`1px solid ${L.border}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 15 : 18, fontWeight: 700, color: L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 160 : "none" }}>{contacto.nombre || contacto.telefono}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: est.bg, color: est.color, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>{est.label}</span>
            </div>
            <div style={{ fontSize: 11.5, color: L.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {contacto.telefono}</span>
              {contacto.empresa && !isMobile && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={11} /> {contacto.empresa}</span>}
            </div>
          </div>
          {!isMobile && (
            <>
              <button onClick={() => setDrawer(true)}
                style={{ background: L.soft, border: `1px solid ${L.border}`, color: L.muted, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all .15s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.muted; }}>
                <Pencil size={14} /> Editar
              </button>
              <button onClick={eliminarChat} title="Eliminar chat completo"
                style={{ background: L.soft, border: `1px solid ${L.border}`, color: "#EF4444", borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all .15s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#EF4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = L.soft; e.currentTarget.style.borderColor = L.border; }}>
                <Trash2 size={14} /> Eliminar
              </button>
            </>
          )}
        </div>
        {/* Fila 2: acciones (scrollable en mobile) */}
        <div className={isMobile ? "strip" : ""} style={{ display: "flex", gap: 7, alignItems: "center", marginTop: isMobile ? 9 : 10, overflowX: isMobile ? "auto" : "visible", flexWrap: isMobile ? "nowrap" : "wrap", paddingBottom: isMobile ? 2 : 0 }}>
          {isMobile && (
            <>
              <button onClick={() => setDrawer(true)}
                style={{ ...btnSt, flexShrink: 0, fontSize: 12, padding: "6px 11px", background: L.soft, color: L.muted, borderColor: L.border }}>
                <Pencil size={13} /> Editar
              </button>
            </>
          )}
          <select value={contacto.vendedor || ""} onChange={(e) => upd({ vendedor: e.target.value })} style={{ ...selSt, flexShrink: 0, fontSize: 12 }}>
            <option value="">Sin vendedor</option>
            {VENDEDORES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={contacto.estado} onChange={(e) => upd({ estado: e.target.value })} style={{ ...selSt, flexShrink: 0, fontSize: 12 }}>
            {ESTADOS_ACTIVOS.map((k) => <option key={k} value={k}>{ESTADOS[k]?.label || k}</option>)}
            {!ESTADOS_ACTIVOS.includes(contacto.estado) && (
              <option value={contacto.estado}>{ESTADOS[contacto.estado]?.label || contacto.estado}</option>
            )}
          </select>
          {rol !== "administracion" && (
            <button onClick={() => setPanelSeg((v) => !v)}
              style={{ ...btnSt, flexShrink: 0, fontSize: 12, background: panelSeg ? C.gold : L.soft, color: panelSeg ? "#fff" : L.muted, borderColor: panelSeg ? C.gold : L.border }}>
              <Calendar size={13} /> {isMobile ? "" : "Seguimiento"}
            </button>
          )}
          <button onClick={() => upd({ bot_activo: !contacto.bot_activo })}
            title={contacto.bot_activo ? "Pausar el bot y atender vos" : "Reactivar el bot"}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 9,
              padding: isMobile ? "9px 16px" : "10px 20px", borderRadius: 14,
              border: `1px solid ${contacto.bot_activo ? "#A7F3D0" : "#E2E8F0"}`,
              background: contacto.bot_activo ? "#F0FDF4" : "#F8FAFC",
              color: contacto.bot_activo ? "#15803D" : "#475569",
              cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700,
              fontSize: 14, letterSpacing: 0.3, transition: "all .18s",
              boxShadow: contacto.bot_activo ? "0 2px 10px rgba(22,163,74,.14)" : "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = contacto.bot_activo ? "0 4px 14px rgba(22,163,74,.22)" : "0 2px 8px rgba(0,0,0,.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = contacto.bot_activo ? "0 2px 10px rgba(22,163,74,.14)" : "none"; }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: contacto.bot_activo ? "#22C55E" : "#94A3B8", boxShadow: contacto.bot_activo ? "0 0 0 3px rgba(34,197,94,.2)" : "none" }} />
            {contacto.bot_activo ? <><Pause size={16} /> Pausar Bot</> : <><Bot size={16} /> Activar Bot</>}
          </button>
        </div>
      </div>

      {/* ── Panel seguimiento ── */}
      {panelSeg && rol !== "administracion" && (
        <div style={{ background: "#FFFBEB", borderBottom: `1px solid #FDE68A`, padding: isMobile ? "12px 14px" : "13px 22px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lblSt}>Próximo contacto</label>
            <input type="datetime-local" style={{ ...inpSt, width: 215 }}
              defaultValue={contacto.seguimiento_at ? new Date(contacto.seguimiento_at).toISOString().slice(0, 16) : ""}
              onChange={(e) => upd({ seguimiento_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lblSt}>Nota</label>
            <input style={inpSt} placeholder="Ej: confirmar pedido del finde" defaultValue={contacto.nota_seguimiento || ""} onBlur={(e) => upd({ nota_seguimiento: e.target.value })} />
          </div>
        </div>
      )}

      {/* ── Banner bot pausado ── */}
      {!contacto.bot_activo && (
        <div style={{ background: "#FFFBEB", color: "#92400E", fontSize: 12.5, padding: isMobile ? "8px 14px" : "8px 22px", borderBottom: `1px solid #FDE68A`, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          <User size={14} /> <strong>{userName}</strong> — estás atendiendo esta conversación directamente.
        </div>
      )}

      {/* ── Mensajes ── */}
      <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "18px 22px", background: L.bg, backgroundImage: `radial-gradient(${L.border} 0.5px, transparent 0.5px)`, backgroundSize: "20px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign: "center", color: L.light, fontSize: 13.5, marginTop: 40 }}>Sin mensajes en esta conversación aún.</div>
        )}
        {mensajes.map((m) => {
          const esCliente = m.direccion === "in";
          const esBot     = m.origen === "bot" || (m.direccion === "out" && !m.origen && !m.agente);
          const esAgente  = m.origen === "agente";
          const esN8n     = m.origen === "n8n" || m.origen === "webhook" || m.origen === "ia" || m.origen === "agent";
          const hora      = (() => {
            const d = new Date(m.created_at);
            const hoy = new Date();
            const mismoAnio = d.getFullYear() === hoy.getFullYear();
            const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
            if (d.toDateString() === hoy.toDateString()) return time;
            return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", ...(mismoAnio ? {} : { year: "2-digit" }) }) + " · " + time;
          })();
          const isNew = newMsgIds.has(m.id);
          return (
            <div key={m.id}
              onMouseEnter={() => setHoverMsg(m.id)}
              onMouseLeave={() => setHoverMsg(null)}
              style={{ alignSelf: esCliente ? "flex-start" : "flex-end", maxWidth: "70%", display: "flex", flexDirection: "column", gap: 4, position: "relative", animation: isNew ? "msgSlideIn 0.38s ease-out" : "none" }}>
              {/* Remitente */}
              {esCliente && (
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={20} border="none" />
                  <span style={{ fontSize: 11.5, color: L.muted, fontWeight: 700 }}>{contacto.nombre || contacto.telefono}</span>
                </div>
              )}
              {esBot && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10.5, background: "#FEF9C3", color: "#713F12", padding: "2px 9px", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Bot size={11} /> Bot · Nuevo Munich
                  </span>
                </div>
              )}
              {esN8n && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10.5, background: "#DBEAFE", color: "#1D4ED8", padding: "2px 9px", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <Send size={11} /> WhatsApp enviado · n8n
                  </span>
                </div>
              )}
              {esAgente && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10.5, background: "#FEE2E2", color: C.red, padding: "2px 9px", borderRadius: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={11} /> {m.agente || "Agente"} · Nuevo Munich
                  </span>
                </div>
              )}
              {/* Burbuja */}
              {(() => {
              const media = resolverMedia(m);
              const txt = limpiarPrecios(m.contenido || m.body || m.message || m.texto);
              return (
              <div style={{ background: esCliente ? L.white : esAgente ? "#FEF2E2" : esN8n ? "#EFF6FF" : esBot ? "#FFF7E6" : "#FFFBEB", borderRadius: "14px", borderLeft: esCliente ? `3px solid ${isNew ? C.red : L.border}` : "none", borderRight: !esCliente ? `3px solid ${esN8n ? "#2563eb" : esAgente ? C.red : C.gold}` : "none", padding: media ? "6px 6px 8px" : "10px 14px", fontSize: 14, color: L.text, boxShadow: SH.sm, lineHeight: 1.5, whiteSpace: "pre-wrap", animation: isNew ? "msgGlow 2s ease-out" : "none" }}>
                {m.cita_texto && (
                  <div style={{ borderLeft: `3px solid ${C.gold}`, background: "rgba(0,0,0,.04)", borderRadius: 7, padding: "5px 9px", marginBottom: 6, fontSize: 12.5, color: L.muted, whiteSpace: "pre-wrap" }}>
                    <div style={{ fontWeight: 700, color: C.red, fontSize: 11.5, marginBottom: 1 }}>{m.cita_autor || "Mensaje"}</div>
                    <div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.cita_texto}</div>
                  </div>
                )}
                {media && media.tipo === "image" && (
                  <a href={media.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                    <img src={media.url} alt={media.nombre} loading="lazy"
                      style={{ maxWidth: "100%", width: 260, maxHeight: 320, objectFit: "cover", borderRadius: 10, display: "block" }} />
                  </a>
                )}
                {media && media.tipo === "video" && (
                  <video src={media.url} controls preload="metadata"
                    style={{ maxWidth: "100%", width: 260, borderRadius: 10, display: "block", background: "#000" }} />
                )}
                {media && media.tipo === "audio" && (
                  <audio src={media.url} controls style={{ width: 240, display: "block" }} />
                )}
                {media && media.tipo === "document" && (
                  <a href={media.url} target="_blank" rel="noreferrer" download={media.nombre}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(0,0,0,.04)", borderRadius: 10, textDecoration: "none", color: L.text, width: 240, maxWidth: "100%" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: C.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileIcon size={17} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{media.nombre}</div>
                      <div style={{ fontSize: 11, color: L.muted, display: "flex", alignItems: "center", gap: 4 }}><Download size={11} /> Descargar</div>
                    </div>
                  </a>
                )}
                {txt
                  ? <div style={{ padding: media ? "7px 8px 1px" : 0 }}>{txt}</div>
                  : (!media && <span style={{ color: L.light, fontStyle: "italic", fontSize: 12 }}>(mensaje vacío)</span>)}
              </div>
              ); })()}
              {/* Hora + eliminar */}
              {isNew && esCliente && (
                <div style={{ alignSelf: "flex-start", fontSize: 10.5, color: C.red, fontWeight: 700, background: "#FEF2F2", padding: "2px 8px", borderRadius: 999, marginBottom: 2 }}>
                  Nuevo mensaje
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: esCliente ? "flex-start" : "flex-end" }}>
                <div style={{ fontSize: 10.5, color: L.light }}>{hora}</div>
                {hoverMsg === m.id && (
                  <>
                    <button onClick={() => { setReplyTo(m); }} title="Responder este mensaje"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: L.muted, display: "flex", alignItems: "center", borderRadius: 4, opacity: 0.75 }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = 0.75}>
                      <CornerUpLeft size={12} />
                    </button>
                    <button onClick={() => marcarComoPedido(m.contenido)} title="Convertir en pedido"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: C.red, display: "flex", alignItems: "center", borderRadius: 4, opacity: 0.75 }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = 0.75}>
                      <ShoppingBag size={12} />
                    </button>
                    <button onClick={() => eliminarMensaje(m.id)} title="Eliminar mensaje"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "#EF4444", display: "flex", alignItems: "center", borderRadius: 4, opacity: 0.75 }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = 0.75}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {err && <div style={{ background: "#FEF2F2", color: C.red, fontSize: 12.5, padding: "9px 22px", fontWeight: 600, borderTop: `1px solid #FECACA`, display: "flex", gap: 8, alignItems: "center" }}>
        <AlertCircle size={15} /> {err}
      </div>}

      {/* ── Barra de respuesta (estilo WhatsApp) ── */}
      {replyTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "8px 12px" : "8px 22px", background: "#FFF7E6", borderTop: `1px solid ${L.border}`, borderLeft: `3px solid ${C.gold}` }}>
          <CornerUpLeft size={16} color={C.red} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.red }}>Respondiendo a {autorDe(replyTo)}</div>
            <div style={{ fontSize: 12.5, color: L.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{snippetDe(replyTo)}</div>
          </div>
          <button onClick={() => setReplyTo(null)} title="Cancelar respuesta"
            style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", alignItems: "center", padding: 4, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ padding: isMobile ? "10px 12px" : "14px 22px", borderTop: replyTo ? "none" : `1px solid ${L.border}`, background: L.white, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, position: "relative", zIndex: 2, boxShadow: "0 -4px 18px rgba(16,24,40,.05)" }}>
        {/* Inputs ocultos para seleccionar archivos */}
        <input ref={fileImagenRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subirArchivo(f, "image"); }} />
        <input ref={fileVideoRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subirArchivo(f, "video"); }} />
        <input ref={fileDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subirArchivo(f, "document"); }} />

        {/* Menú desplegable de adjuntar (estilo WhatsApp) */}
        {menuAdjuntar && (
          <>
            <div onClick={() => setMenuAdjuntar(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{ position: "absolute", bottom: "100%", left: isMobile ? 12 : 22, marginBottom: 8, background: L.white, borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.18)", border: `1px solid ${L.border}`, padding: 8, zIndex: 50, display: "flex", flexDirection: "column", gap: 2, minWidth: 196 }}>
              {[
                { lbl: "Imagen",    icon: <ImageIcon size={17} />, bg: "#EFF6FF", col: "#2563EB", ref: fileImagenRef },
                { lbl: "Video",     icon: <VideoIcon size={17} />, bg: "#FEF2F2", col: C.red,    ref: fileVideoRef },
                { lbl: "Documento", icon: <FileIcon size={17} />,  bg: "#F0FDF4", col: "#16A34A", ref: fileDocRef },
              ].map((o) => (
                <button key={o.lbl} onClick={() => { setMenuAdjuntar(false); o.ref.current?.click(); }}
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", background: "none", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: L.text, textAlign: "left", transition: "background .12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = L.soft}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: o.bg, color: o.col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{o.icon}</span>
                  {o.lbl}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Botón + adjuntar */}
        <button onClick={() => setMenuAdjuntar((v) => !v)} disabled={subiendo} title="Adjuntar"
          style={{ background: menuAdjuntar ? C.red : L.soft, color: menuAdjuntar ? "#fff" : L.muted, border: `1px solid ${menuAdjuntar ? C.red : L.border}`, borderRadius: 11, width: 44, height: 44, cursor: subiendo ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .18s", transform: menuAdjuntar ? "rotate(45deg)" : "none" }}>
          {subiendo ? <Upload size={18} className="spin" /> : <Plus size={22} />}
        </button>

        <textarea value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={isMobile ? "Escribí un mensaje…" : "Escribí un mensaje… (Enter para enviar · Shift+Enter = nueva línea)"} rows={1}
          style={{ flex: 1, resize: "none", border: `1px solid ${L.border}`, borderRadius: 11, padding: "11px 14px", fontSize: 14, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none", maxHeight: 120, lineHeight: 1.5 }} />
        <button onClick={enviar} disabled={enviando}
          style={{ background: enviando ? L.light : C.red, color: "#fff", border: "none", borderRadius: 11, padding: isMobile ? "11px 16px" : "11px 22px", fontSize: 14, fontWeight: 700, cursor: enviando ? "default" : "pointer", fontFamily: FONT_DISPLAY, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 7, boxShadow: enviando ? "none" : "0 2px 10px rgba(185,28,28,.3)", transition: "all .2s", flexShrink: 0 }}>
          <Send size={16} /> {enviando || isMobile ? (enviando ? "…" : "") : "Enviar"}
        </button>
      </div>

      {drawer && <ContactoDrawer contacto={contacto} onClose={() => setDrawer(false)} onSave={onUpdateContacto} />}
      {pedidoModal && (
        <NuevoPedidoModal
          contacto={contacto}
          vendedorActual={contacto.vendedor}
          mensajeInicial={msgParaPedido}
          onClose={() => { setPedido(false); setMsgParaPedido(null); }}
          onGuardado={() => {}}
        />
      )}
    </div>
  );
}

// ============================================================
// PANEL VENDEDORES (admin) — pedidos/actividad de cada vendedor
// ============================================================
function VendedoresPanel({ isMobile }) {
  const [sel, setSel] = useState("__todos__");
  const opciones = ["__todos__", ...VENDEDORES];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Selector: Todos + cada vendedor (botones rectangulares) */}
      <div className="strip" style={{ display: "flex", gap: 8, padding: isMobile ? "10px 12px" : "12px 18px", overflowX: "auto", background: L.white, borderBottom: `1px solid ${L.border}`, flexShrink: 0 }}>
        {opciones.map((v) => {
          const on = sel === v;
          const esTodos = v === "__todos__";
          return (
            <button key={v} onClick={() => setSel(v)}
              style={{ flexShrink: 0, padding: "9px 18px", borderRadius: 8, border: `1px solid ${on ? C.red : L.border}`, background: on ? C.red : L.white, color: on ? "#fff" : L.muted, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: 0.4, textTransform: "uppercase", transition: "all .15s" }}>
              {esTodos ? "Todos" : v}
            </button>
          );
        })}
      </div>
      {/* Contenido */}
      <div style={{ flex: 1, minHeight: 0, overflowY: sel === "__todos__" ? "auto" : "visible" }}>
        {sel === "__todos__"
          ? <PedidosDelDia isMobile={isMobile} />
          : <VendedorDashboard key={sel} vendorAliasOverride={sel} />}
      </div>
    </div>
  );
}

// Todos los pedidos cargados hoy (de todos los vendedores), separados en
// dos pestañas: Pedidos reales y Reportes (visitas) de vendedores.
function PedidosDelDia({ isMobile }) {
  const [pedidos, setPedidos] = useState([]);
  const [contactos, setContactos] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pedido"); // "pedido" | "reporte"

  const cargar = useCallback(async () => {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("pedidos").select("*")
      .gte("created_at", inicio.toISOString())
      .order("created_at", { ascending: false });
    const peds = data || [];
    setPedidos(peds);
    const ids = [...new Set(peds.map((p) => p.contacto_id).filter(Boolean))];
    if (ids.length) {
      const { data: cs } = await supabase.from("contactos").select("id,nombre,telefono").in("id", ids);
      const map = {}; (cs || []).forEach((c) => { map[c.id] = c; });
      setContactos(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
    const ch = supabase.channel("pedidos-dia")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, cargar).subscribe();
    return () => supabase.removeChannel(ch);
  }, [cargar]);

  const hoyTxt = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  const esReporte = (p) => parseDet(p.detalle).tipo === "visita";
  const soloPedidos = pedidos.filter((p) => !esReporte(p));
  const reportes    = pedidos.filter(esReporte);
  const lista = tab === "reporte" ? reportes : soloPedidos;

  return (
    <div style={{ padding: isMobile ? "14px 12px" : "20px 24px", background: L.bg, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: L.text, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {tab === "reporte" ? "Reportes del día" : "Pedidos del día"}
        </div>
        <div style={{ fontSize: 13, color: L.muted, textTransform: "capitalize" }}>{hoyTxt} · {lista.length} {tab === "reporte" ? (lista.length === 1 ? "reporte" : "reportes") : (lista.length === 1 ? "pedido" : "pedidos")}</div>
      </div>

      {/* Pestañas Pedidos / Reportes */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { k: "pedido",  label: "Pedidos",  icon: <Package size={14} />,  count: soloPedidos.length },
          { k: "reporte", label: "Reportes", icon: <FileText size={14} />, count: reportes.length },
        ].map(({ k, label, icon, count }) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: `1px solid ${on ? C.red : L.border}`, background: on ? C.red : L.white, color: on ? "#fff" : L.muted, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: 0.3, textTransform: "uppercase", transition: "all .15s" }}>
              {icon} {label}
              <span style={{ background: on ? "rgba(255,255,255,.25)" : L.soft, color: on ? "#fff" : L.muted, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: L.light, fontSize: 14, padding: 40 }}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign: "center", color: L.light, fontSize: 14, padding: 40, background: L.white, borderRadius: 12, border: `1px solid ${L.border}` }}>
          {tab === "reporte" ? "Todavía no hay reportes cargados hoy." : "Todavía no hay pedidos cargados hoy."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((p) => {
            const cont = contactos[p.contacto_id] || {};
            const det = parseDet(p.detalle);
            const ep = EP[p.estado] || EP.pendiente;
            const nombre = cont.nombre || det.clienteNombre || cont.telefono || "—";
            const items = (det.items || []).filter((i) => i.desc?.trim());
            const hora = new Date(p.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
            const esRep = tab === "reporte";
            return (
              <div key={p.id} style={{ background: L.white, border: `1px solid ${L.border}`, borderLeft: `4px solid ${esRep ? "#15803D" : ep.color}`, borderRadius: 12, padding: "13px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: L.text }}>{nombre}</span>
                    {p.vendedor && <span style={{ fontSize: 11, color: C.red, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><User size={11} />{p.vendedor}</span>}
                    {esRep
                      ? <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 6, background: "#DCFCE7", color: "#15803D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Reporte</span>
                      : <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 6, background: ep.bg, color: ep.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{ep.label}</span>}
                  </div>
                  <span style={{ fontSize: 11.5, color: L.light }}>{hora}</span>
                </div>
                <div style={{ fontSize: 13, color: L.muted, lineHeight: 1.5 }}>
                  {esRep
                    ? <span style={{ fontStyle: "italic" }}>{limpiarPrecios(det.observacion || det.notas) || "Sin detalle"}</span>
                    : items.length > 0
                      ? items.map((it, idx) => <span key={idx}>{idx > 0 ? " · " : ""}<strong>{it.qty}×</strong> {limpiarPrecios(it.desc)}</span>)
                      : <span style={{ fontStyle: "italic" }}>{limpiarPrecios(det.observacion) || "Sin detalle"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
// Cierra sesión y, si estamos en el APK, borra el token push de este celular.
async function cerrarSesion() {
  await limpiarPush().catch(() => {});
  await supabase.auth.signOut();
}

export default function App() {
  const isMobile = useIsMobile();
  const [session,   setSession]   = useState(null);
  const [contactos, setContactos] = useState([]);
  const [activo,    setActivo]    = useState(null);
  const [vista,     setVista]     = useState("chat");
  const [ready,     setReady]     = useState(false);
  const [showImportarApp, setShowImportarApp] = useState(false);
  // Ref para evitar mostrar login si hubo sesión previa y solo es un refresh
  const tuvoSesion = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Solo actualizar sesión en eventos explícitos, evitar flashes durante refresh
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(s);
      }
    });
    initNativo();
    return () => sub.subscription.unsubscribe();
  }, []);

  // Registrar el celular para notificaciones push (solo dentro del APK)
  useEffect(() => {
    if (session && esNativo()) initPush(session);
  }, [session]);

  // Al tocar una notificación push, abrir el chat o la sección correspondiente.
  useEffect(() => {
    if (!esNativo()) return;
    const abrirChat = (e) => {
      const id = e.detail?.contacto_id;
      setVista("chat");
      const c = contactos.find((x) => x.id === id);
      if (c) setActivo(c);
    };
    // Solo vistas reales del layout: "mensajes" es un panel del rail, no una vista.
    const VISTAS_OK = ["chat", "vendedores", "pedidos", "calendario", "contactos", "reportes", "ajustes", "admin", "marketing", "notas"];
    const abrirVista = (e) => {
      const v = e.detail?.vista;
      if (VISTAS_OK.includes(v)) { setVista(v); setActivo(null); }
    };
    window.addEventListener("push:abrir-chat", abrirChat);
    window.addEventListener("push:abrir-vista", abrirVista);
    return () => {
      window.removeEventListener("push:abrir-chat", abrirChat);
      window.removeEventListener("push:abrir-vista", abrirVista);
    };
  }, [contactos]);

  useEffect(() => {
    if (!session) return;
    const rolActual  = getRol(session.user.email);
    const userNombre = session.user.email.split("@")[0].replace(/^\w/, m => m.toUpperCase());

    const cargar = async () => {
      if (rolActual === "vendedor_panel") return;
      let query = supabase.from("contactos").select("*").order("updated_at", { ascending: false });
      if (rolActual === "vendedor") query = query.eq("vendedor", userNombre);
      const { data: contactosData } = await query;
      const lista = contactosData || [];

      // Auto-detectar vendedores por teléfono (tabla DB + lista estática)
      const { data: vendDB } = await supabase
        .from("vendedores").select("telefono_whatsapp").not("telefono_whatsapp", "is", null);
      const staticPhones = VENDEDORES_INFO.filter(v => v.telefono).map(v => v.telefono.replace(/\D/g, ""));
      const dbPhones = (vendDB || []).map(v => v.telefono_whatsapp.replace(/\D/g, "")).filter(Boolean);
      const vendPhones = [...new Set([...staticPhones, ...dbPhones])];
      if (vendPhones.length > 0) {
        const sinMarcar = lista.filter(c => {
          if (c.es_vendedor) return false;
          const cPhone = (c.telefono || "").replace(/\D/g, "");
          // Comparar por los últimos 8 dígitos sólo si AMBOS números son largos
          // de verdad. Antes bastaba un teléfono mal cargado en la tabla de
          // vendedores (ponele "351") para que cientos de contactos
          // "terminaran igual", quedaran marcados como vendedores y
          // desaparecieran de la lista de Chats. Y encima se guardaba en la base.
          if (cPhone.length < 10) return false;
          return vendPhones.some(vp =>
            vp.length >= 10 && (cPhone === vp || cPhone.slice(-8) === vp.slice(-8))
          );
        });
        if (sinMarcar.length > 0) {
          await supabase.from("contactos").update({ es_vendedor: true }).in("id", sinMarcar.map(c => c.id));
          sinMarcar.forEach(c => { c.es_vendedor = true; });
        }
      }

      setContactos(lista);
    };

    cargar();
    const ch = supabase.channel("contactos-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "contactos" }, cargar).subscribe();
    return () => supabase.removeChannel(ch);
  }, [session]);

  const updateContacto = (c) => {
    setContactos((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    if (activo?.id === c.id) setActivo(c);
  };

  const toggleDestacado = async (c) => {
    const nuevo = !c.destacado;
    updateContacto({ ...c, destacado: nuevo });          // optimista
    await supabase.from("contactos").update({ destacado: nuevo }).eq("id", c.id);
  };

  if (session) tuvoSesion.current = true;
  if (!ready) return null;
  // No mostrar login si tuvo sesión previa y solo está refrescando token
  if (!session && !tuvoSesion.current) return (<><FontLoader /><Login /></>);
  if (!session) return null; // espera silenciosa si tuvo sesión (evita flash de login)

  const userEmail = session.user.email;
  const userName  = userEmail.split("@")[0].replace(/^\w/, (m) => m.toUpperCase());
  const rol       = getRol(userEmail);
  const alertas   = calcularAlertas(contactos);
  // Contadores que muestra el rail de navegación
  // Cuántas conversaciones están esperando respuesta: el cliente escribió
  // último y nadie le contestó.
  //
  // Antes se sumaba no_leidos de todos los contactos, pero ese contador lo
  // resetea únicamente Administración al abrir el chat: cuando lo abre
  // Cristian no baja nunca, se acumula y termina mostrando el total
  // histórico en vez de lo que falta atender. Esto en cambio se limpia solo
  // en cuanto alguien responde, sin importar quién lo haya leído.
  const navBadges = {
    chat: contactos.filter((c) =>
      c.ultimo_in_at && (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at))
    ).length,
  };

  // Vendedores externos ven su propio panel
  if (rol === "vendedor_panel") {
    return (
      <>
        <FontLoader />
        <VendedorDashboard userEmail={userEmail} onLogout={() => cerrarSesion()} />
      </>
    );
  }

  // Personal de administración usa el layout principal (chats + vendedores + pedidos)
  // con el panel de gestión de pedidos en la pestaña Pedidos.

  // En mobile: mostramos sidebar O panel, no ambos a la vez
  const mobileInPanel = isMobile && (activo !== null || vista === "pedidos" || vista === "vendedores" || vista === "reportes" || vista === "admin" || vista === "ajustes" || vista === "calendario" || vista === "notas");

  return (
    // CSS media queries en index.html controlan qué panel es visible en mobile
    // .in-panel = hay panel activo → ocultar sidebar, mostrar app-main
    <div className={`app-layout${mobileInPanel ? " in-panel" : ""}`}
      style={{ fontFamily: FONT_BODY, background: L.bg }}>
      <FontLoader />

      {/* Rail de navegación — desktop. En mobile va como barra inferior. */}
      {!isMobile && (
        <NavRail vista={vista} setVista={(v) => { setVista(v); if (v !== "chat") setActivo(null); }}
          rol={rol} userName={userName} userEmail={userEmail}
          onLogout={() => cerrarSesion()} badges={navBadges} />
      )}

      {/* Sidebar — CSS lo oculta en mobile cuando hay .in-panel */}
      <div className="app-sidebar">
        <Sidebar contactos={contactos} activo={activo}
          onSelect={(c) => setActivo(c)}
          onToggleDestacado={toggleDestacado}
          onLogout={() => cerrarSesion()}
          userEmail={userEmail} userName={userName}
          vista={vista} setVista={setVista} alertas={alertas}
          isMobile={isMobile} rol={rol} />
      </div>

      {/* Panel principal — CSS lo muestra en mobile sólo con .in-panel */}
      <div className="app-main">
        {vista === "ajustes" ? (
          <>
            {isMobile && <MobileBack title="Ajustes" onBack={() => setVista("chat")} />}
            <AjustesPanel userName={userName} userEmail={userEmail} rol={rol} isMobile={isMobile} />
          </>
        ) : vista === "admin" && rol === "admin" ? (
          <>
            {isMobile && <MobileBack title="Admin" onBack={() => setVista("chat")} />}
            <AdminPanel userName={userName} isMobile={isMobile} />
          </>
        ) : vista === "calendario" ? (
          <>
            {isMobile && <MobileBack title="Calendario" onBack={() => setVista("chat")} />}
            <Suspense fallback={<div style={{ flex: 1, background: L.bg }} />}>
              <Calendario userEmail={userEmail} isMobile={isMobile} />
            </Suspense>
          </>
        ) : vista === "marketing" && rol === "admin" && marketingHabilitado() ? (
          <>
            {isMobile && <MobileBack title="Marketing" onBack={() => setVista("chat")} />}
            <Suspense fallback={<div style={{ flex: 1, background: L.bg }} />}>
              <Marketing userEmail={userEmail} isMobile={isMobile} />
            </Suspense>
          </>
        ) : vista === "notas" ? (
          <>
            {isMobile && <MobileBack title="Notas" onBack={() => setVista("chat")} />}
            <Suspense fallback={<div style={{ flex: 1, background: L.bg }} />}>
              <Notas userName={userName} userEmail={userEmail} isMobile={isMobile} />
            </Suspense>
          </>
        ) : vista === "reportes" ? (
          <>
            {isMobile && <MobileBack title="Reportes" onBack={() => setVista("chat")} />}
            <div className="scroll-y" style={{ flex: 1, overflowY: "auto" }}><Reportes /></div>
          </>
        ) : vista === "pedidos" ? (
          <>
            {isMobile && <MobileBack title="Pedidos" onBack={() => setVista("chat")} />}
            {rol === "administracion"
              ? <div style={{ flex: 1, minHeight: 0 }}><AdministracionPanel userName={userName} userEmail={userEmail} rol={rol} /></div>
              : <div className="scroll-y" style={{ flex: 1, overflowY: "auto" }}><PedidosPanel rol={rol} /></div>}
          </>
        ) : vista === "vendedores" ? (
          <>
            {isMobile && <MobileBack title="Vendedores" onBack={() => setVista("chat")} />}
            <VendedoresPanel isMobile={isMobile} />
          </>
        ) : activo ? (
          <ChatPanel contacto={activo} onUpdateContacto={updateContacto} userName={userName}
            onBack={isMobile ? () => setActivo(null) : undefined}
            isMobile={isMobile} rol={rol}
            onEliminar={() => { setActivo(null); setContactos((prev) => prev.filter((c) => c.id !== activo.id)); }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: L.bg, flexDirection: "column", gap: 20, padding: "0 20px" }}>
            <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 180, objectFit: "contain" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ color: L.text, fontSize: 20, fontFamily: FONT_DISPLAY, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>Nuevo Munich CRM</div>
              <div style={{ color: L.muted, fontSize: 14, marginTop: 8 }}>
                {rol === "admin" ? `Bienvenido, ${userName} · Panel de administración disponible` : rol === "administracion" ? `Bienvenido, ${userName} · Seguimiento de pedidos` : `Seleccioná una conversación para comenzar`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {[[<MessageSquare size={16} />, "Chats en tiempo real"], [<Bot size={16} />, "Bot WhatsApp integrado"], [<BarChart2 size={16} />, "Reportes y métricas"]].map(([icon, txt]) => (
                <div key={txt} style={{ padding: "10px 18px", background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, fontSize: 13, color: L.muted, display: "flex", alignItems: "center", gap: 8, fontWeight: 500, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                  <span style={{ color: C.red }}>{icon}</span> {txt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navegación mobile — sólo con la lista visible (el panel usa su propio back) */}
      {isMobile && !mobileInPanel && (
        <NavMobile vista={vista} setVista={(v) => { setVista(v); if (v !== "chat") setActivo(null); }}
          rol={rol} userName={userName}
          onLogout={() => cerrarSesion()} badges={navBadges} />
      )}

      <AvisosEnVivo userEmail={userEmail} rol={rol} contactos={contactos}
        onAbrirContacto={(id) => {
          const c = contactos.find((x) => x.id === id);
          setVista("chat");
          if (c) setActivo(c);
        }}
        onIrA={(v) => { setVista(v); setActivo(null); }} />

      {rol === "admin" && <AIAsistente contactoActivo={activo} onActualizarContacto={setActivo} userName={userName} userEmail={userEmail} />}
      {showImportarApp && <ImportarContactosModal onClose={() => setShowImportarApp(false)} />}
    </div>
  );
}

// ============================================================
// ESTILOS BASE
// ============================================================
const lblSt  = { display: "block", fontSize: 11.5, color: L.muted, marginBottom: 6, fontWeight: 700, letterSpacing: 0.3 };
const inpSt  = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 8, border: `1px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, background: L.white, color: L.text, outline: "none" };
const selSt  = { border: `1px solid ${L.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: L.text, cursor: "pointer", fontWeight: 500, outline: "none" };
const btnSt  = { border: "1px solid", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" };
