import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Search, LogOut, MessageSquare, BarChart2, Package,
  Pencil, Bot, User, Calendar, Send, X, Check,
  Sparkles, Phone, Mail, Building2, MapPin, FileText,
  AlertCircle, Clock, ChevronDown, ChevronLeft, Zap, ShoppingBag, Shield, Trash2,
  Mic, MicOff, Volume2, VolumeX,
  Copy, Users, TrendingUp, CalendarCheck, RotateCcw, Upload, Settings, UserCheck, Eye, EyeOff, Menu,
} from "lucide-react";
import PedidosPanel, { NuevoPedidoModal, imprimirPedido } from "./Pedidos";
import {
  supabase, N8N_SEND_WEBHOOK, LOGO_URL, C, FONT_DISPLAY, FONT_BODY,
  VENDEDORES, ESTADOS, ESTADOS_ACTIVOS, VENDEDORES_INFO, ADMINISTRACION_INFO, calcularAlertas, getRol,
} from "./lib";
import Reportes from "./Reportes";
import AdminPanel from "./AdminPanel";
import VendedorDashboard from "./VendedorPanel";
import AdministracionPanel from "./AdministracionPanel";

// ============================================================
// PALETA LIGHT — tema claro profesional
// ============================================================
const L = {
  bg:     "#F5F6F8",
  white:  "#FFFFFF",
  border: "#E4E8ED",
  text:   "#0F172A",
  muted:  "#64748B",
  light:  "#94A3B8",
  soft:   "#F1F5F9",
  hover:  "#FEF2F2",
  active: "#FFF1F0",
};

// Avatares — colores consistentes por nombre
const AVT = [
  ["#B91C1C","#fff"],["#1D4ED8","#fff"],["#15803D","#fff"],
  ["#7C3AED","#fff"],["#B45309","#fff"],["#0E7490","#fff"],
  ["#9D174D","#fff"],["#374151","#fff"],["#C2410C","#fff"],
  ["#1E40AF","#fff"],
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
// FONT LOADER
// ============================================================
function FontLoader() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
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
    if (error) setErr("Email o contraseña incorrectos.");
    setLoad(false);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.soft, transition: "border-color .2s" };

  return (
    <div className="login-scroll" style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: FONT_BODY, padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <img src={LOGO_URL} alt="Nuevo Munich" style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <div style={{ height: 1, width: 28, background: L.border }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 700, letterSpacing: 4, color: L.light, textTransform: "uppercase" }}>CRM</span>
            <div style={{ height: 1, width: 28, background: L.border }} />
          </div>
        </div>

        {err && (
          <div style={{ color: C.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "#FEF2F2", borderRadius: 10, border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={15} /> {err}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="tu@nuevomunich.com.ar"
            style={inp} autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Contraseña</label>
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
          style={{ width: "100%", background: loading ? L.light : C.red, color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT_DISPLAY, letterSpacing: 1.5, boxShadow: loading ? "none" : "0 4px 16px rgba(156,27,27,.3)", transition: "all .2s" }}>
          {loading ? "Entrando…" : "ENTRAR"}
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
    <div style={{ padding: "11px 16px", background: L.white, borderBottom: `3px solid ${C.gold}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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
    const { error } = await supabase.from("contactos").update(form).eq("id", contacto.id);
    if (error) {
      if (error.code === "PGRST204" || (error.message && error.message.includes("column"))) {
        const { error: e2 } = await supabase.from("contactos")
          .update({ nombre: form.nombre, nota_seguimiento: form.nota_seguimiento }).eq("id", contacto.id);
        if (!e2) { onSave({ ...contacto, nombre: form.nombre, nota_seguimiento: form.nota_seguimiento }); setSaved(true); setTimeout(() => setSaved(false), 2500); }
        else setErr("Ejecutá la migración en supabase_schema.sql para guardar todos los campos.");
      } else setErr("Error: " + error.message);
    } else {
      onSave({ ...contacto, ...form }); setSaved(true); setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const inputSt = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.soft };
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
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : 390, background: L.white, boxShadow: "-6px 0 40px rgba(0,0,0,.18)", zIndex: 201, display: "flex", flexDirection: "column", fontFamily: FONT_BODY }}>
        {/* Header */}
        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={52} border={`2px solid ${C.gold}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: L.text }}>{contacto.nombre || "Nuevo contacto"}</div>
            <div style={{ fontSize: 12.5, color: L.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
              <Phone size={12} /> {contacto.telefono}
            </div>
          </div>
          <button onClick={onClose} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
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
          <div style={{ marginBottom: 18, padding: "13px 16px", background: esVend ? "#DCFCE7" : L.soft, borderRadius: 10, border: `1.5px solid ${esVend ? "#86EFAC" : L.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all .2s" }}>
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
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, padding: 11, fontSize: 14, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600 }}>Cancelar</button>
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
function AIAsistente({ contactoActivo, onActualizarContacto }) {
  const isMobile = useIsMobile();
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([
    { from: "ai", text: `¡Hola! Soy tu asistente de Nuevo Munich, estoy acá para lo que necesites.\n\nPuedo ayudarte con:\n• **Métricas y reportes** en tiempo real\n• **Redactar mensajes** de WhatsApp listos para enviar\n• **Cambiar estados**, asignar vendedores y agendar seguimientos\n• **Consejos para cerrar ventas** en gastronomía y delivery\n\nPodés escribirme o hablarme directamente. ¿Con qué arrancamos?`, time: new Date().toISOString() },
  ]);
  const [input, setInput]     = useState("");
  const [typing, setTyping]   = useState(false);
  const [recording, setRecording]     = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceOn, setVoiceOn]         = useState(false);
  const [copiedId, setCopiedId]       = useState(null);
  const voiceOnRef        = useRef(false);
  const voiceRef          = useRef(null);
  const currentAudioRef   = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const chunksRef         = useRef([]);
  const bottomRef         = useRef(null);

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

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

  // Inyectar animación de pulso para el micrófono
  useEffect(() => {
    const id = "mic-pulse-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(156,27,27,.5)}50%{box-shadow:0 0 0 8px rgba(156,27,27,0)}}`;
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

  const enviar = useCallback(async (textoOverride) => {
    const q = (textoOverride ?? input).trim();
    if (!q || typing) return;
    setMsgs((p) => [...p, { from: "user", text: q, time: new Date().toISOString() }]);
    if (!textoOverride) setInput("");
    setTyping(true);
    const startTime = Date.now();

    const grokKey = import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    if (!grokKey) {
      const err = "⚠️ Falta configurar VITE_GROK_API_KEY en las variables de entorno de Vercel.";
      setMsgs((p) => [...p, { from: "ai", text: err }]);
      setTyping(false); return;
    }

    try {
      const hoy = new Date();
      const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - 6); inicioSemana.setHours(0,0,0,0);

      const [contRes, pedRes, msgRes] = await Promise.all([
        supabase.from("contactos").select("id,nombre,telefono,estado,vendedor,created_at"),
        supabase.from("pedidos").select("id,total,estado,vendedor,created_at,detalle").gte("created_at", inicioSemana.toISOString()),
        supabase.from("mensajes").select("id,direccion,created_at").gte("created_at", inicioSemana.toISOString()),
      ]);

      const contactos = contRes.data || [];
      const pedidos   = pedRes.data  || [];
      const mensajes  = msgRes.data  || [];

      const nuevosHoy    = contactos.filter((c) => new Date(c.created_at).toDateString() === hoy.toDateString()).length;
      const nuevosSemana = contactos.filter((c) => new Date(c.created_at) >= inicioSemana).length;
      const vendidos     = contactos.filter((c) => c.estado === "vendido").length;
      const facturacion  = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const porVendedor  = VENDEDORES.map((v) => ({ vendedor: v, pedidos: pedidos.filter((p) => p.vendedor === v).length, total: pedidos.filter((p) => p.vendedor === v).reduce((s, p) => s + (Number(p.total) || 0), 0) }));

      const estadosCounts = {};
      for (const c of contactos) estadosCounts[c.estado] = (estadosCounts[c.estado] || 0) + 1;
      const sinResponder = contactos.filter((c) => !c.bot_activo && c.ultimo_in_at && (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at))).length;

      const ctx = `Sos "Muni", el asistente IA del equipo de ventas de **Nuevo Munich**, hamburguesería artesanal premium de Buenos Aires.
Actuás como un empleado experimentado, amable y proactivo que conoce el negocio de memoria. Tu misión es hacer que el equipo venda más y mejor.
El negocio vende principalmente por WhatsApp: los clientes consultan, eligen y coordinan entregas/retiros por ahí.

HOY ES: ${hoy.toLocaleDateString("es-AR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}

MÉTRICAS EN TIEMPO REAL:
• Contactos totales: ${contactos.length} | Nuevos hoy: ${nuevosHoy} | Esta semana: ${nuevosSemana}
• Pipeline: ${Object.entries(estadosCounts).map(([e, n]) => `${ESTADOS[e]?.label || e} (${n})`).join(" · ")}
• Sin responder (bot pausado): ${sinResponder}
• Vendidos: ${vendidos} | Pedidos esta semana: ${pedidos.length}
• Facturación esta semana: $${facturacion.toLocaleString("es-AR")}
• Mensajes recibidos esta semana: ${mensajes.filter((m) => m.direccion === "in").length}
• Por vendedor esta semana:
${porVendedor.filter((v) => v.pedidos > 0).map((v) => `  ${v.vendedor}: ${v.pedidos} pedidos · $${v.total.toLocaleString("es-AR")}`).join("\n") || "  Sin pedidos registrados esta semana"}
${contactoActivo ? `
CONTACTO ABIERTO AHORA:
• Nombre: ${contactoActivo.nombre || "(sin nombre)"}  Tel: ${contactoActivo.telefono}
• Estado: ${ESTADOS[contactoActivo.estado]?.label || contactoActivo.estado}  Vendedor: ${contactoActivo.vendedor || "sin asignar"}
${contactoActivo.nota_seguimiento ? `• Nota: ${contactoActivo.nota_seguimiento}` : ""}
${contactoActivo.direccion ? `• Dirección: ${contactoActivo.direccion}` : ""}` : "\nNo hay contacto abierto actualmente."}

ACCIONES DISPONIBLES (ponelas al final de tu respuesta, solo si el usuario lo pide o tiene sentido ejecutarlas):
[ACCION:ESTADO:estado]       → estados válidos: nuevo, contactado, interesado, pendiente, vendido, perdido
[ACCION:VENDEDOR:nombre]     → asignar o crear un vendedor nuevo para el contacto abierto. Podés usar cualquier nombre válido, aunque no esté en la lista.
[ACCION:PEDIDO:descripcion]  → crear pedido para el contacto abierto
[ACCION:NOTA:texto]          → guardar nota de seguimiento
[ACCION:SEGUIMIENTO:días|motivo] → ej: [ACCION:SEGUIMIENTO:2|Llamar para confirmar pedido]

CÓMO COMPORTARTE (MUY IMPORTANTE):
- Español rioplatense natural (vos/ustedes), cálido y cercano — como un compañero de trabajo que sabe mucho
- Siempre mostrá disposición para ayudar más: terminá cada respuesta con una oferta concreta de siguiente paso o preguntá si necesitan algo más
- Sé proactivo: si ves métricas preocupantes o oportunidades, mencionálas aunque no te las pidan
- Si piden un mensaje para enviarle al cliente, escribilo ya listo para copiar y pegar, usando *negrita* como WhatsApp
- Contextualizá los consejos de venta en gastronomía/delivery de hamburguesas artesanales
- Confirmá siempre antes de ejecutar una acción sobre el contacto (a menos que el usuario lo pida explícitamente)
- Si no hay contacto abierto y se pide ejecutar una acción, sugerí cuál abrir según el contexto
- Nunca respondas con listas largas y frías — preferí respuestas conversacionales, cálidas y accionables
- Tratá a los vendedores como si fueran tus colegas — con respeto, buen humor y ganas de ayudar`;

      const historial = msgs.slice(-8).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text }));
      historial.push({ role: "user", content: q });

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${grokKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: ctx }, ...historial],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
      const json = await res.json();
      if (json.error) {
        const err = `⚠️ Error: ${json.error.message || json.error.type}`;
        setMsgs((p) => [...p, { from: "ai", text: err, time: new Date().toISOString() }]);
        speak(err);
      } else {
        let texto = json.choices?.[0]?.message?.content || "Sin respuesta.";

        const accionRegex = /\[ACCION:([A-Z]+):([^\]]+)\]/g;
        const acciones = [...texto.matchAll(accionRegex)].map((m) => ({ tipo: m[1], valor: m[2].trim() }));
        texto = texto.replace(accionRegex, "").trim();

        for (const accion of acciones) {
          try {
            if (accion.tipo === "ESTADO" && contactoActivo) {
              await supabase.from("contactos").update({ estado: accion.valor }).eq("id", contactoActivo.id);
              onActualizarContacto?.({ ...contactoActivo, estado: accion.valor });
            } else if (accion.tipo === "VENDEDOR" && contactoActivo) {
              await supabase.from("contactos").update({ vendedor: accion.valor }).eq("id", contactoActivo.id);
              onActualizarContacto?.({ ...contactoActivo, vendedor: accion.valor });
            } else if (accion.tipo === "PEDIDO" && contactoActivo) {
              const det = JSON.stringify({ items: [{ desc: accion.valor, qty: 1, precio: 0 }], notas: "", entrega: "Retiro en local", direccion: contactoActivo.direccion || "", pago: "Efectivo" });
              await supabase.from("pedidos").insert({ contacto_id: contactoActivo.id, vendedor: contactoActivo.vendedor || "", detalle: det, total: 0, estado: "pendiente" });
            } else if (accion.tipo === "NOTA" && contactoActivo) {
              await supabase.from("contactos").update({ nota_seguimiento: accion.valor }).eq("id", contactoActivo.id);
              onActualizarContacto?.({ ...contactoActivo, nota_seguimiento: accion.valor });
            } else if (accion.tipo === "SEGUIMIENTO" && contactoActivo) {
              const [diasStr, motivo] = accion.valor.split("|");
              const dias = Math.max(1, parseInt(diasStr) || 1);
              const fecha = new Date();
              fecha.setDate(fecha.getDate() + dias);
              fecha.setHours(10, 0, 0, 0);
              await supabase.from("contactos").update({ seguimiento_at: fecha.toISOString(), nota_seguimiento: motivo?.trim() || "Seguimiento" }).eq("id", contactoActivo.id);
              onActualizarContacto?.({ ...contactoActivo, seguimiento_at: fecha.toISOString(), nota_seguimiento: motivo?.trim() || "Seguimiento" });
            }
          } catch { /* acción falló, igual mostramos la respuesta */ }
        }

        const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);
        setMsgs((p) => [...p, { from: "ai", text: texto, time: new Date().toISOString(), responseTime }]);
        speak(texto);
      }
    } catch (e) {
      setMsgs((p) => [...p, { from: "ai", text: `Error de conexión: ${e.message}`, time: new Date().toISOString() }]);
    }
    setTyping(false);
  }, [input, typing, msgs, contactoActivo, onActualizarContacto, speak]);

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
            headers: { "Authorization": `Bearer ${import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_GEMINI_API_KEY}` },
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

  const sugerencias = contactoActivo
    ? [`Mensaje para ${contactoActivo.nombre || "este cliente"}`, "Agendar seguimiento para mañana", "Cambiar estado a vendido"]
    : ["Resumen de ventas de hoy", "¿Quién vendió más esta semana?", "Clientes sin responder"];

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setOpen((v) => !v)} title="Asistente IA"
        style={{ position: "fixed", bottom: isMobile ? "calc(16px + env(safe-area-inset-bottom))" : 20, right: isMobile ? 16 : 24, width: isMobile ? 48 : 54, height: isMobile ? 48 : 54, borderRadius: "50%", background: open ? "#e2e8f0" : C.red, border: "none", color: open ? C.red : "#fff", cursor: "pointer", boxShadow: `0 4px 20px rgba(156,27,27,.35)`, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s, transform .2s" }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Panel */}
      {open && (
        <div style={{ position: "fixed", bottom: isMobile ? "calc(76px + env(safe-area-inset-bottom))" : 86, right: 16, ...(isMobile ? { left: 16 } : { width: 460 }), height: isMobile ? "75dvh" : "min(600px, calc(100vh - 120px))", maxHeight: isMobile ? "calc(100% - 80px)" : "calc(100vh - 120px)", background: "#fff", borderRadius: isMobile ? "20px 20px 16px 16px" : 20, boxShadow: "0 8px 40px rgba(0,0,0,.14)", border: "1px solid #E2E8F0", borderLeft: `3px solid ${C.red}`, zIndex: 299, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_BODY }}>
          {/* Header minimalista */}
          <div style={{ background: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #E2E8F0" }}>
            <img src={LOGO_URL} alt="NM" style={{ height: 44, objectFit: "contain", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.red, letterSpacing: 0.2, lineHeight: 1 }}>Asistente IA</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{typing ? "Escribiendo…" : "Nuevo Munich · Online"}</div>
            </div>
            {/* Toggle voz */}
            <button onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? "Silenciar voz" : "Activar voz"}
              style={{ background: voiceOn ? "#fef2f2" : "#f8fafc", border: `1.5px solid ${voiceOn ? C.red : "#E2E8F0"}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {voiceOn ? <Volume2 size={15} color={C.red} /> : <VolumeX size={15} color="#94a3b8" />}
            </button>
            <button onClick={() => setOpen(false)} title="Cerrar"
              style={{ background: "#f8fafc", border: "1.5px solid #E2E8F0", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={15} color="#64748b" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, background: "#f8fafc" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start", flexDirection: "column", alignItems: m.from === "user" ? "flex-end" : "flex-start", gap: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "85%" }}>
                  {m.from === "ai" && (
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      <Sparkles size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{ padding: "10px 14px", borderRadius: m.from === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: m.from === "user" ? C.red : "#fff", color: m.from === "user" ? "#fff" : "#1e293b", fontSize: 13.5, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: m.from === "user" ? "none" : "1px solid #E2E8F0" }}>
                    {renderMd(m.text)}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, fontSize: 11, color: "#64748b" }}>
                      <span>{m.time ? new Date(m.time).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      {m.responseTime && <span>Respondió en {m.responseTime}s</span>}
                    </div>
                    {m.from === "ai" && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, borderTop: "1px solid #f1f5f9", paddingTop: 5 }}>
                        <button onClick={() => { navigator.clipboard?.writeText(m.text.replace(/\*\*([^*]+)\*\*/g, "$1")); setCopiedId(i); setTimeout(() => setCopiedId(null), 1500); }}
                          title="Copiar respuesta"
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: copiedId === i ? "#22c55e" : "#94a3b8", fontSize: 11, padding: "2px 4px", borderRadius: 6 }}>
                          {copiedId === i ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedId === i ? "Copiado" : "Copiar"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones rápidas debajo del primer mensaje de la IA */}
                {m.from === "ai" && i === 0 && msgs.length <= 1 && !typing && (
                  <div style={{ marginTop: 10, marginLeft: 38, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                    {[
                      { icon: <TrendingUp size={16} color={C.red} />, label: "Métricas de hoy",       q: "Dame un resumen de las métricas de hoy" },
                      { icon: <MessageSquare size={16} color={C.red} />, label: "Redactar WhatsApp", q: contactoActivo ? `Redactá un mensaje de WhatsApp para ${contactoActivo.nombre || "este cliente"}` : "¿Cómo redacto un buen mensaje de WhatsApp de ventas?" },
                      { icon: <CalendarCheck size={16} color={C.red} />, label: "Agendar seguimiento", q: contactoActivo ? "Agendá un seguimiento para mañana para este contacto" : "¿Cómo gestiono los seguimientos?" },
                      { icon: <Users size={16} color={C.red} />,         label: "Leads sin responder", q: "¿Cuántos leads están sin responder ahora y quiénes son?" },
                    ].map(({ icon, label, q }) => (
                      <button key={label} onClick={() => enviar(q)}
                        style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7, textAlign: "left", fontFamily: FONT_BODY, transition: "border-color .15s, box-shadow .15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.boxShadow = `0 0 0 2px rgba(156,27,27,.08)`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b", lineHeight: 1.3 }}>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={14} color="#fff" />
                </div>
                <div style={{ padding: "10px 16px", background: "#fff", borderRadius: "4px 16px 16px 16px", border: "1px solid #E2E8F0" }}>
                  <span style={{ color: C.red, fontWeight: 700, letterSpacing: 3, fontSize: 16 }}>···</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #E2E8F0", display: "flex", gap: 8, background: "#fff", alignItems: "flex-end" }}>
            {/* Botón micrófono */}
            <button onClick={toggleMic} disabled={transcribing} title={recording ? "Detener grabación" : "Hablar"}
              style={{ background: recording ? "#fef2f2" : transcribing ? "#fff7ed" : "#f8fafc", border: `1.5px solid ${recording ? C.red : transcribing ? "#f97316" : "#E2E8F0"}`, borderRadius: 10, width: 40, height: 40, cursor: transcribing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: recording ? "micPulse 1.2s ease-in-out infinite" : "none" }}>
              {transcribing
                ? <span style={{ fontSize: 13, fontWeight: 700, color: "#f97316", letterSpacing: 2 }}>···</span>
                : recording ? <MicOff size={16} color={C.red} /> : <Mic size={16} color="#64748b" />}
            </button>
            <textarea value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={transcribing ? "Procesando audio…" : recording ? "Grabando… tocá para detener" : "Preguntame algo… (Enter para enviar)"}
              rows={1}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13.5, fontFamily: FONT_BODY, outline: "none", color: "#1e293b", background: "#f8fafc", resize: "none", lineHeight: 1.5, maxHeight: 100, overflowY: "auto" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={() => enviar()} disabled={typing}
                style={{ background: typing ? "#e2e8f0" : C.red, border: "none", color: "#fff", borderRadius: 10, width: 40, height: 40, cursor: typing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} />
              </button>
              {msgs.length > 1 && (
                <button onClick={() => { setMsgs([msgs[0]]); setInput(""); }} title="Limpiar conversación"
                  style={{ background: "#f8fafc", border: "1.5px solid #E2E8F0", color: "#94a3b8", borderRadius: 10, width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
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

function Sidebar({ contactos, activo, onSelect, onLogout, userEmail, userName, vista, setVista, alertas, isMobile, rol }) {
  const [filtro, setFiltro]           = useState("todos");
  const [busqueda, setBusqueda]       = useState("");
  const [showImportar, setShowImportar] = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const menuRef                       = useRef(null);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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

  const lista = baseContactos.filter((c) => {
    const porEstado = filtro === "todos" || c.estado === filtro;
    const porBusq   = !busqueda || (c.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || c.telefono.includes(busqueda);
    return porEstado && porBusq;
  });

  return (
    <div style={{ width: "100%", height: "100%", background: L.white, borderRight: `1px solid ${L.border}`, display: "flex", flexDirection: "column" }}>

      {/* ── Brand bar ── */}
      <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${C.gold}`, background: L.white }}>
        <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 118, objectFit: "contain", maxWidth: 240 }} />
        <AlertasBtn alertas={alertas} onSelect={(c) => { setVista("chat"); onSelect(c); }} />
      </div>

      {/* ── Tabs principales + menú hamburguesa ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${L.border}`, background: L.white, flexShrink: 0 }}>
        {/* 3 tabs principales */}
        {[
          ["chat",       <MessageSquare size={14} />, "Chats"],
          ["vendedores", <UserCheck size={14} />,     "Vendedores"],
          ["pedidos",    <Package size={14} />,       "Pedidos"],
        ].map(([k, icon, l]) => (
          <button key={k} onClick={() => setVista(k)}
            style={{ flex: 1, border: "none", cursor: "pointer", padding: "12px 0 10px", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: vista === k ? C.red : L.muted, background: "transparent", borderBottom: vista === k ? `2.5px solid ${C.red}` : "2.5px solid transparent" }}>
            {icon} {l}
          </button>
        ))}

        {/* Separador */}
        <div style={{ width: 1, background: L.border, margin: "8px 0" }} />

        {/* Hamburguesa */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{ width: 46, height: "100%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: menuOpen ? "#FFF5F5" : "transparent", color: ["contactos","reportes","ajustes","admin"].includes(vista) ? C.red : L.muted, transition: "all .15s", borderBottom: ["contactos","reportes","ajustes","admin"].includes(vista) ? `2.5px solid ${C.red}` : "2.5px solid transparent" }}>
            <Menu size={17} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", width: 180, background: L.white, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,.14)", border: `1px solid ${L.border}`, zIndex: 200, overflow: "hidden" }}>
              {[
                ["contactos",  <Users size={14} />,    "Contactos"],
                ["reportes",   <BarChart2 size={14} />, "Reportes"],
                ["ajustes",    <Settings size={14} />,  "Ajustes"],
                ...(rol === "admin" ? [["admin", <Shield size={14} />, "Admin"]] : []),
              ].map(([k, icon, l]) => (
                <button key={k} onClick={() => { setVista(k); setMenuOpen(false); }}
                  style={{ width: "100%", border: "none", cursor: "pointer", padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, background: vista === k ? "#FFF5F5" : "transparent", color: vista === k ? C.red : L.text, borderLeft: vista === k ? `3px solid ${C.red}` : "3px solid transparent", transition: "background .12s" }}
                  onMouseEnter={e => { if (vista !== k) e.currentTarget.style.background = L.soft; }}
                  onMouseLeave={e => { if (vista !== k) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ color: vista === k ? C.red : L.muted }}>{icon}</span> {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {(vista === "chat" || vista === "contactos" || vista === "vendedores") && (
        <>
          {/* ── Búsqueda ── */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${L.border}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={vista === "contactos" ? "Buscar contacto…" : "Buscar conversación…"}
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1.5px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
              {/* Botón importar solo en pestaña Contactos */}
              {vista === "contactos" && (
                <button onClick={() => setShowImportar(true)} title="Importar contactos desde CSV o VCF"
                  style={{ flexShrink: 0, height: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: L.soft, border: `1.5px solid ${L.border}`, borderRadius: 10, cursor: "pointer", color: L.muted, transition: "all .15s", padding: "0 11px", fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY, whiteSpace: "nowrap" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.color = "#1D4ED8"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.muted; }}>
                  <Upload size={14} /> Importar
                </button>
              )}
            </div>
          </div>

          {/* ── Filtro estado (desplegable) ── */}
          <div style={{ padding: "8px 14px", borderBottom: `1px solid ${L.border}` }}>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${filtro !== "todos" ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, fontWeight: 700, color: filtro !== "todos" ? C.red : L.muted, background: L.white, cursor: "pointer", outline: "none" }}>
              <option value="todos">Todos los estados</option>
              {ESTADOS_ACTIVOS.map((f) => (
                <option key={f} value={f}>{ESTADOS[f]?.label || f}</option>
              ))}
            </select>
          </div>

          {/* ── Lista contactos ── */}
          <div className="scroll-y" style={{ overflowY: "auto", flex: 1 }}>
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
                  style={{ padding: "13px 14px", borderBottom: `1px solid ${L.border}`, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", background: sel ? L.active : "transparent", borderLeft: sel ? `3px solid ${C.red}` : "3px solid transparent", transition: "background .12s" }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = L.hover; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
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
                        <span style={{ fontSize: 11, color: L.light }}>{hora}</span>
                        {c.no_leidos > 0 && (
                          <span style={{ background: "#22C55E", color: "#fff", fontSize: 10, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", fontWeight: 800 }}>{c.no_leidos}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: L.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>
                      {c.ultimo_msg || (c.empresa ? `🏢 ${c.empresa}` : c.email ? `✉ ${c.email}` : "Sin mensajes aún")}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
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
      {vista === "reportes" && <div style={{ flex: 1 }} />}

      {showImportar && <ImportarContactosModal onClose={() => setShowImportar(false)} />}

      {/* ── Pie usuario ── */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 11, background: L.white }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>
          {(userName || "U")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
          <div style={{ fontSize: 11, color: L.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
        </div>
        <button onClick={onLogout} title="Cerrar sesión"
          style={{ background: "transparent", border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = L.hover; e.currentTarget.style.color = C.red; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = L.muted; }}>
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CHAT PANEL
// ============================================================
function ChatPanel({ contacto, onUpdateContacto, userName, onBack, isMobile, onEliminar }) {
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
  const endRef = useRef(null);

  useEffect(() => {
    const id = "msg-new-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        @keyframes msgSlideIn{0%{opacity:0;transform:translateX(-14px)}70%{transform:translateX(3px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes msgGlow{0%{box-shadow:0 0 0 0 rgba(156,27,27,.45),0 1px 4px rgba(0,0,0,.07)}65%{box-shadow:0 0 0 8px rgba(156,27,27,0),0 1px 4px rgba(0,0,0,.07)}100%{box-shadow:0 1px 4px rgba(0,0,0,.07)}}
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

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("mensajes").select("*").eq("contacto_id", contacto.id).order("created_at", { ascending: true });
    setMensajes(data || []);
    await supabase.from("contactos").update({ no_leidos: 0 }).eq("id", contacto.id);
  }, [contacto.id]);

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`msg-${contacto.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `contacto_id=eq.${contacto.id}` },
        (p) => {
          setMensajes((m) => m.some((x) => x.id === p.new.id) ? m : [...m, p.new]);
          if (p.new.direccion === "in" || p.new.origen === "bot" || p.new.origen === "n8n") {
            setNewMsgIds((s) => new Set([...s, p.new.id]));
            setTimeout(() => setNewMsgIds((s) => { const n = new Set(s); n.delete(p.new.id); return n; }), 2500);
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

    // 1) Guardar en CRM (Supabase)
    const { data, error } = await supabase.from("mensajes").insert({
      contacto_id: contacto.id, direccion: "out", origen: "agente", agente: userName, contenido: cuerpo,
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
        const msgWA = `*${userName} · Nuevo Munich:*\n${cuerpo}`;
        const res = await fetch(N8N_SEND_WEBHOOK, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefono: contacto.telefono, mensaje: msgWA, agente: userName }),
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
      <div style={{ padding: isMobile ? "10px 14px" : "12px 22px", borderBottom: `1px solid ${L.border}`, background: L.white, boxShadow: "0 1px 6px rgba(0,0,0,.06)", flexShrink: 0 }}>
        {/* Fila 1: contacto info */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
          {isMobile && onBack && (
            <button onClick={onBack}
              style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </button>
          )}
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={isMobile ? 38 : 48} border={`2px solid ${C.gold}`} />
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
                style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all .15s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.muted; }}>
                <Pencil size={14} /> Editar
              </button>
              <button onClick={eliminarChat} title="Eliminar chat completo"
                style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: "#EF4444", borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, transition: "all .15s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#EF4444"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = L.soft; e.currentTarget.style.borderColor = L.border; }}>
                <Trash2 size={14} /> Eliminar
              </button>
              <button onClick={() => setPedido(true)}
                style={{ background: C.red, border: "none", color: "#fff", borderRadius: 9, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(185,28,28,.3)", transition: "all .15s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.redDark; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.red; }}>
                <ShoppingBag size={14} /> Nuevo Pedido
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
              <button onClick={() => setPedido(true)}
                style={{ ...btnSt, flexShrink: 0, fontSize: 12, padding: "6px 11px", background: C.red, color: "#fff", borderColor: C.red }}>
                <ShoppingBag size={13} /> Pedido
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
          <button onClick={() => setPanelSeg((v) => !v)}
            style={{ ...btnSt, flexShrink: 0, fontSize: 12, background: panelSeg ? C.gold : L.soft, color: panelSeg ? "#fff" : L.muted, borderColor: panelSeg ? C.gold : L.border }}>
            <Calendar size={13} /> {isMobile ? "" : "Seguimiento"}
          </button>
          <button onClick={() => upd({ bot_activo: !contacto.bot_activo })}
            style={{ ...btnSt, flexShrink: 0, fontSize: 12, background: contacto.bot_activo ? "#DCFCE7" : "#FEF2F2", color: contacto.bot_activo ? "#15803D" : C.red, borderColor: contacto.bot_activo ? "#86EFAC" : "#FECACA" }}>
            {contacto.bot_activo ? <><Bot size={13} /> Bot</> : <><User size={13} /> {isMobile ? "Agente" : "Yo atiendo"}</>}
          </button>
        </div>
      </div>

      {/* ── Panel seguimiento ── */}
      {panelSeg && (
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
              <div style={{ background: esCliente ? L.white : esAgente ? "#FEF2E2" : esN8n ? "#EFF6FF" : esBot ? "#FFF7E6" : "#FFFBEB", borderRadius: "14px", borderLeft: esCliente ? `3px solid ${isNew ? C.red : L.border}` : "none", borderRight: !esCliente ? `3px solid ${esN8n ? "#2563eb" : esAgente ? C.red : C.gold}` : "none", padding: "10px 14px", fontSize: 14, color: L.text, boxShadow: "0 1px 4px rgba(0,0,0,.07)", lineHeight: 1.5, whiteSpace: "pre-wrap", animation: isNew ? "msgGlow 2s ease-out" : "none" }}>
                {m.contenido || m.body || m.message || m.texto || <span style={{ color: L.light, fontStyle: "italic", fontSize: 12 }}>(mensaje vacío)</span>}
              </div>
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

      {/* ── Input ── */}
      <div style={{ padding: isMobile ? "10px 12px" : "14px 22px", borderTop: `1px solid ${L.border}`, background: L.white, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={isMobile ? "Escribí un mensaje…" : "Escribí un mensaje… (Enter para enviar · Shift+Enter = nueva línea)"} rows={1}
          style={{ flex: 1, resize: "none", border: `1.5px solid ${L.border}`, borderRadius: 11, padding: "11px 14px", fontSize: 14, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none", maxHeight: 120, lineHeight: 1.5 }} />
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
// APP
// ============================================================
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
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const rolActual  = getRol(session.user.email);
    const userNombre = session.user.email.split("@")[0].replace(/^\w/, m => m.toUpperCase());

    const cargar = async () => {
      if (rolActual === "vendedor_panel" || rolActual === "administracion") return;
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
          return vendPhones.some(vp => cPhone === vp || cPhone.endsWith(vp.slice(-8)) || vp.endsWith(cPhone.slice(-8)));
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

  if (session) tuvoSesion.current = true;
  if (!ready) return null;
  // No mostrar login si tuvo sesión previa y solo está refrescando token
  if (!session && !tuvoSesion.current) return (<><FontLoader /><Login /></>);
  if (!session) return null; // espera silenciosa si tuvo sesión (evita flash de login)

  const userEmail = session.user.email;
  const userName  = userEmail.split("@")[0].replace(/^\w/, (m) => m.toUpperCase());
  const rol       = getRol(userEmail);
  const alertas   = calcularAlertas(contactos);

  // Vendedores externos ven su propio panel
  if (rol === "vendedor_panel") {
    return (
      <>
        <FontLoader />
        <VendedorDashboard userEmail={userEmail} onLogout={() => supabase.auth.signOut()} />
      </>
    );
  }

  // Personal de administración ve el panel de gestión de pedidos
  if (rol === "administracion") {
    return (
      <>
        <FontLoader />
        <AdministracionPanel
          userName={userName}
          userEmail={userEmail}
          onLogout={() => supabase.auth.signOut()}
        />
      </>
    );
  }

  // En mobile: mostramos sidebar O panel, no ambos a la vez
  const mobileInPanel = isMobile && (activo !== null || vista === "pedidos" || vista === "reportes" || vista === "admin" || vista === "ajustes");

  return (
    // CSS media queries en index.html controlan qué panel es visible en mobile
    // .in-panel = hay panel activo → ocultar sidebar, mostrar app-main
    <div className={`app-layout${mobileInPanel ? " in-panel" : ""}`}
      style={{ fontFamily: FONT_BODY, background: L.bg }}>
      <FontLoader />

      {/* Sidebar — CSS lo oculta en mobile cuando hay .in-panel */}
      <div className="app-sidebar">
        <Sidebar contactos={contactos} activo={activo}
          onSelect={(c) => setActivo(c)}
          onLogout={() => supabase.auth.signOut()}
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
        ) : vista === "reportes" ? (
          <>
            {isMobile && <MobileBack title="Reportes" onBack={() => setVista("chat")} />}
            <div className="scroll-y" style={{ flex: 1, overflowY: "auto" }}><Reportes /></div>
          </>
        ) : vista === "pedidos" ? (
          <>
            {isMobile && <MobileBack title="Pedidos" onBack={() => setVista("chat")} />}
            <div className="scroll-y" style={{ flex: 1, overflowY: "auto" }}><PedidosPanel rol={rol} /></div>
          </>
        ) : activo ? (
          <ChatPanel contacto={activo} onUpdateContacto={updateContacto} userName={userName}
            onBack={isMobile ? () => setActivo(null) : undefined}
            isMobile={isMobile}
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

      {rol === "admin" && <AIAsistente contactoActivo={activo} onActualizarContacto={setActivo} />}
      {showImportarApp && <ImportarContactosModal onClose={() => setShowImportarApp(false)} />}
    </div>
  );
}

// ============================================================
// ESTILOS BASE
// ============================================================
const lblSt  = { display: "block", fontSize: 11.5, color: L.muted, marginBottom: 6, fontWeight: 700, letterSpacing: 0.3 };
const inpSt  = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 8, border: `1.5px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, background: L.white, color: L.text, outline: "none" };
const selSt  = { border: `1.5px solid ${L.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: L.text, cursor: "pointer", fontWeight: 500, outline: "none" };
const btnSt  = { border: "1.5px solid", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY, display: "flex", alignItems: "center", gap: 6, transition: "all .15s" };
