import { useState, useEffect, useRef, useCallback } from "react";
import {
  supabase, N8N_SEND_WEBHOOK, LOGO_URL, C, FONT_DISPLAY, FONT_BODY,
  VENDEDORES, ESTADOS, calcularAlertas,
} from "./lib";
import Reportes from "./Reportes";

// ============================================================
// PALETA SIDEBAR OSCURO
// ============================================================
const D = {
  bg:      "#0f172a",
  surface: "#1e293b",
  border:  "#2d3748",
  text:    "#f1f5f9",
  muted:   "#94a3b8",
  hover:   "#1e3a5f",
  active:  "#162032",
};

// Colores de avatar — consistente por nombre
const AVT_PALETTES = [
  ["#9c1b1b","#fff"], ["#1a4a7a","#fff"], ["#2d5a1b","#fff"],
  ["#6a1b8a","#fff"], ["#b45309","#fff"], ["#0f5e5e","#fff"],
  ["#7a3a1b","#fff"], ["#374151","#fff"], ["#be185d","#fff"],
  ["#0369a1","#fff"],
];

// Base de conocimiento del asistente IA
const IA_KB = [
  {
    tags: ["hola","ayuda","help","empezar","que podes","inicio"],
    r: `¡Hola! 👋 Soy el asistente de Munich CRM.\n\nPuedo ayudarte con:\n• Asignar vendedores y cambiar estados\n• Configurar seguimientos y recordatorios\n• Usar el bot de WhatsApp\n• Guardar datos completos de contactos\n• Ver reportes y métricas\n\n¿Sobre qué necesitás ayuda?`,
  },
  {
    tags: ["estado","mover","pipeline","cambiar estado","embudo"],
    r: `**Cambiar estado de un contacto:**\n1. Abrí la conversación\n2. Usá el selector "Estado" en el encabezado\n3. Opciones: Nuevo → En conversación → Pedido → Cerrado\n\nTambién podés filtrar la lista por estado usando los botones del sidebar.`,
  },
  {
    tags: ["vendedor","asignar","asignacion","quien atiende"],
    r: `**Asignar un vendedor:**\n1. Abrí la conversación del contacto\n2. Usá el selector "Vendedor" en el encabezado\n3. El cambio se guarda automáticamente\n\nVendedores disponibles: ${VENDEDORES.join(", ")}`,
  },
  {
    tags: ["seguimiento","recordatorio","agendar","schedule","cuando"],
    r: `**Configurar un seguimiento:**\n1. Abrí la conversación\n2. Clic en 📌 Seguimiento\n3. Elegí fecha y hora del próximo contacto\n4. Agregá una nota opcional\n\nCuando llegue el momento, aparece una 🔔 alerta automáticamente.`,
  },
  {
    tags: ["bot","automatico","pausar","activar bot","ia bot"],
    r: `**El bot de WhatsApp:**\n🤖 **Bot activo** = responde automáticamente a los clientes\n✋ **Atendido por mí** = vos manejás la conversación manualmente\n\nCuando pausás el bot, tus mensajes van directo por WhatsApp al cliente.`,
  },
  {
    tags: ["alerta","notificacion","campana","urgente"],
    r: `**Alertas 🔔** — te avisan sobre:\n\n⏰ Clientes que esperan respuesta hace +1h (bot pausado)\n👤 Leads nuevos sin vendedor asignado hace +2h\n📌 Seguimientos vencidos\n\nHacé clic en la alerta para ir directamente al contacto.`,
  },
  {
    tags: ["reporte","estadistica","grafico","datos","metrica","analitica"],
    r: `**Reportes** — accedé desde la pestaña 📊 del sidebar.\n\nVer métricas de:\n• Mensajes enviados/recibidos\n• Nuevos contactos por período\n• Pedidos y facturación\n• Performance por vendedor\n\nExportá a **PDF o CSV** y filtrá por día/semana/mes/año.`,
  },
  {
    tags: ["contacto","guardar","editar","datos","info","email","empresa","direccion"],
    r: `**Guardar datos del contacto:**\n1. Abrí la conversación\n2. Hacé clic en el nombre del contacto o en ✏️\n3. Completá: email, empresa, dirección, notas\n4. Clic en "Guardar Contacto"\n\nToda la información queda guardada para usarla después.`,
  },
  {
    tags: ["buscar","filtrar","encontrar","search"],
    r: `**Buscar contactos:**\nUsá la barra de búsqueda en el sidebar para buscar por nombre o número de teléfono.\n\nFiltrá por estado usando los botones de colores: Todos, Nuevo, En conversación, Pedido, etc.`,
  },
  {
    tags: ["whatsapp","mensaje","enviar","comunicar"],
    r: `**Enviar mensajes:**\n1. Seleccioná un contacto\n2. Escribí en el campo de texto\n3. Presioná Enter (o clic en Enviar)\n\nEl mensaje va directo por WhatsApp. Shift+Enter para nueva línea sin enviar.\n\n⚠️ El bot debe estar pausado para que vos puedas atender.`,
  },
  {
    tags: ["cristian","boris","pablo","sandra","luis","marcelino","vendedor"],
    r: `**Vendedores del equipo:**\n${VENDEDORES.map(v => `• ${v}`).join("\n")}\n\nPodés asignar un vendedor a cada contacto desde el selector en el encabezado del chat.`,
  },
];

// ============================================================
// FONT LOADER
// ============================================================
function FontLoader() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
  }, []);
  return null;
}

// ============================================================
// AVATAR — muestra iniciales con color consistente por nombre
// ============================================================
function Avatar({ nombre, foto, size = 40, border }) {
  const initials = (nombre || "?")
    .split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const code = nombre
    ? (nombre.charCodeAt(0) * 3 + (nombre.charCodeAt(1) || 0) * 7) % AVT_PALETTES.length
    : 0;
  const [bg, fg] = AVT_PALETTES[code];

  if (foto) {
    return (
      <img src={foto} alt={nombre}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: border || "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }}
        onError={(e) => { e.target.style.display = "none"; }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: Math.round(size * 0.37),
      flexShrink: 0, border: border || "2px solid rgba(255,255,255,0.1)",
      letterSpacing: 0.5, userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

// ============================================================
// LOGIN — pantalla de acceso
// ============================================================
function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) setErr("Email o contraseña incorrectos.");
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "12px 16px",
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 14, fontFamily: FONT_BODY, background: "rgba(255,255,255,0.07)",
    color: "#fff", outline: "none", marginBottom: 14,
    transition: "border-color .2s",
  };
  const labelStyle = {
    display: "block", fontSize: 11, color: "rgba(255,255,255,0.5)",
    marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(145deg, ${D.bg} 0%, #1a1f35 50%, #2a0d0d 100%)`,
      fontFamily: FONT_BODY, padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        borderRadius: 20, padding: "44px 40px",
        boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 90, height: 90, borderRadius: 22, background: C.red,
            margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 32px rgba(156,27,27,0.5)`,
          }}>
            <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 68, objectFit: "contain" }} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff", letterSpacing: 1 }}>NUEVO MUNICH</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 4, textTransform: "uppercase", marginTop: 4 }}>
            Sistema de Gestión CRM
          </div>
        </div>
        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="tu@nuevomunich.com.ar" />
        <label style={labelStyle}>Contraseña</label>
        <input style={inputStyle} type="password" value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="••••••••" />
        {err && (
          <div style={{ color: "#fc8181", fontSize: 13, marginBottom: 12, fontWeight: 500, padding: "8px 12px", background: "rgba(252,129,129,0.1)", borderRadius: 8 }}>
            {err}
          </div>
        )}
        <button onClick={handleLogin} disabled={loading}
          style={{
            width: "100%", marginTop: 4,
            background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDark} 100%)`,
            color: "#fff", border: "none", borderRadius: 10, padding: "14px 22px",
            fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer",
            fontFamily: FONT_DISPLAY, letterSpacing: 1.5, opacity: loading ? 0.7 : 1,
            boxShadow: "0 4px 24px rgba(156,27,27,0.45)", transition: "all .2s",
          }}>
          {loading ? "Entrando…" : "ENTRAR"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ALERTAS BTN
// ============================================================
function AlertasBtn({ alertas, onSelect }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setAbierto((v) => !v)} title="Alertas"
        style={{
          position: "relative", background: "rgba(255,255,255,.1)",
          border: "1px solid rgba(255,255,255,.15)", color: "#fff",
          borderRadius: 10, width: 38, height: 38, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        🔔
        {alertas.length > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, background: C.gold, color: C.charcoal,
            fontSize: 10, fontWeight: 800, borderRadius: 10, minWidth: 18, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
            border: `2px solid ${D.bg}`,
          }}>
            {alertas.length}
          </span>
        )}
      </button>
      {abierto && (
        <div style={{
          position: "absolute", right: 0, top: 46, width: 340, maxHeight: 400, overflowY: "auto",
          background: D.surface, borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,.6)", border: `1px solid ${D.border}`, zIndex: 100,
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${D.border}`,
            fontFamily: FONT_DISPLAY, fontWeight: 600, color: D.text,
            textTransform: "uppercase", fontSize: 12, letterSpacing: 1,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            Alertas
            {alertas.length > 0 && (
              <span style={{ background: C.red, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>
                {alertas.length}
              </span>
            )}
          </div>
          {alertas.length === 0
            ? <div style={{ padding: 24, color: D.muted, fontSize: 14, textAlign: "center" }}>Todo al día ✓</div>
            : alertas.map((a) => (
              <div key={a.id}
                onClick={() => { onSelect(a.contacto); setAbierto(false); }}
                style={{
                  padding: "12px 18px", borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                  display: "flex", gap: 12, alignItems: "flex-start", transition: "background .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                  {a.tipo === "sin_respuesta" ? "⏰" : a.tipo === "lead_sin_asignar" ? "👤" : "📌"}
                </span>
                <span style={{ fontSize: 13, color: D.text, lineHeight: 1.4 }}>{a.texto}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONTACT DRAWER — editar y guardar datos del contacto
// ============================================================
function ContactoDrawer({ contacto, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre:           contacto.nombre           || "",
    email:            contacto.email            || "",
    empresa:          contacto.empresa          || "",
    direccion:        contacto.direccion        || "",
    nota_seguimiento: contacto.nota_seguimiento || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado]   = useState(false);
  const [err, setErr]             = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setGuardando(true); setErr("");
    const campos = {
      nombre:           form.nombre,
      email:            form.email,
      empresa:          form.empresa,
      direccion:        form.direccion,
      nota_seguimiento: form.nota_seguimiento,
    };
    const { error } = await supabase.from("contactos").update(campos).eq("id", contacto.id);
    if (error) {
      // Fallback: solo campos que siempre existen
      if (error.code === "PGRST204" || (error.message && error.message.includes("column"))) {
        const { error: e2 } = await supabase.from("contactos")
          .update({ nombre: form.nombre, nota_seguimiento: form.nota_seguimiento })
          .eq("id", contacto.id);
        if (!e2) {
          onSave({ ...contacto, nombre: form.nombre, nota_seguimiento: form.nota_seguimiento });
          setGuardado(true);
          setTimeout(() => setGuardado(false), 2500);
        } else {
          setErr("Error al guardar. Ejecutá la migración de BD (ver supabase_schema.sql).");
        }
      } else {
        setErr("Error: " + error.message);
      }
    } else {
      onSave({ ...contacto, ...campos });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    }
    setGuardando(false);
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "10px 13px",
    borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14,
    fontFamily: FONT_BODY, color: C.ink, outline: "none", background: "#fff",
  };
  const labelStyle = {
    display: "block", fontSize: 11, color: C.muted, marginBottom: 6,
    fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 200 }} />
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 380,
        background: C.paper, boxShadow: "-8px 0 50px rgba(0,0,0,.3)",
        zIndex: 201, display: "flex", flexDirection: "column", fontFamily: FONT_BODY,
        animation: "slideIn .25s ease",
      }}>
        {/* Cabecera */}
        <div style={{
          background: C.red, color: "#fff", padding: "16px 22px",
          display: "flex", alignItems: "center", gap: 14,
          borderBottom: `3px solid ${C.gold}`,
        }}>
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={50} border="2px solid rgba(255,255,255,.35)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>
              {contacto.nombre || "Sin nombre"}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 3 }}>{contacto.telefono}</div>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
            Información del Contacto
          </div>

          {[
            { label: "Nombre completo", key: "nombre", type: "text", ph: "Ej: Juan García" },
            { label: "Email", key: "email", type: "email", ph: "juan@empresa.com" },
            { label: "Empresa / Comercio", key: "empresa", type: "text", ph: "Nombre del negocio o empresa" },
            { label: "Dirección", key: "direccion", type: "text", ph: "Calle, Localidad, Provincia" },
          ].map(({ label, key, type, ph }) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <label style={labelStyle}>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} placeholder={ph} style={inputStyle} />
            </div>
          ))}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Notas internas</label>
            <textarea value={form.nota_seguimiento} onChange={set("nota_seguimiento")}
              placeholder="Notas sobre el cliente, preferencias, acuerdos..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </div>

          <div style={{ padding: "14px 16px", background: "#f0f9ff", borderRadius: 10, border: `1px solid #bae6fd` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Teléfono WhatsApp</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.charcoal }}>{contacto.telefono}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>El teléfono no se puede modificar</div>
          </div>

          {err && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: C.redDark, fontSize: 13, fontWeight: 500 }}>
              ⚠️ {err}
            </div>
          )}
        </div>

        {/* Pie */}
        <div style={{ padding: "16px 22px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: 11, fontSize: 14, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={guardando}
            style={{
              flex: 2, background: guardado ? "#22c55e" : C.red, color: "#fff", border: "none",
              borderRadius: 8, padding: 11, fontSize: 14, cursor: "pointer",
              fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.5,
              opacity: guardando ? 0.75 : 1, transition: "background .3s",
              boxShadow: guardado ? "0 2px 10px rgba(34,197,94,.3)" : "0 2px 10px rgba(156,27,27,.3)",
            }}>
            {guardado ? "✓ Guardado" : guardando ? "Guardando…" : "Guardar Contacto"}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// ASISTENTE IA — panel flotante de ayuda
// ============================================================
function AIAsistente({ contactoActivo }) {
  const [abierto, setAbierto]   = useState(false);
  const [mensajes, setMensajes] = useState([
    { from: "ai", text: "¡Hola! 👋 Soy el asistente de **Munich CRM**.\n\n¿En qué puedo ayudarte hoy?" },
  ]);
  const [input, setInput]       = useState("");
  const [escribiendo, setEsc]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto]);

  const enviar = () => {
    const q = input.trim();
    if (!q || escribiendo) return;
    setMensajes((prev) => [...prev, { from: "user", text: q }]);
    setInput("");
    setEsc(true);

    const qLow = q.toLowerCase();
    let resp = "No tengo información sobre eso, pero podés preguntarme sobre vendedores, estados, seguimientos, reportes, el bot de WhatsApp o cómo guardar contactos.";

    for (const item of IA_KB) {
      if (item.tags.some((t) => qLow.includes(t))) { resp = item.r; break; }
    }

    if (contactoActivo && (qLow.includes("este") || qLow.includes("actual") || qLow.includes("cliente"))) {
      const est = ESTADOS[contactoActivo.estado];
      resp += `\n\n📋 **Contacto activo:** ${contactoActivo.nombre || contactoActivo.telefono}\nEstado: ${est?.label || contactoActivo.estado}${contactoActivo.vendedor ? ` · Vendedor: ${contactoActivo.vendedor}` : ""}`;
    }

    setTimeout(() => {
      setMensajes((prev) => [...prev, { from: "ai", text: resp }]);
      setEsc(false);
    }, 700);
  };

  return (
    <>
      {/* Botón flotante */}
      <button onClick={() => setAbierto((v) => !v)} title="Asistente IA"
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 54, height: 54, borderRadius: "50%",
          background: abierto
            ? "#475569"
            : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          border: "none", color: "#fff", fontSize: 22, cursor: "pointer",
          boxShadow: "0 4px 24px rgba(99,102,241,.55)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform .2s, background .3s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
        {abierto ? "✕" : "✨"}
      </button>

      {/* Panel chat */}
      {abierto && (
        <div style={{
          position: "fixed", bottom: 90, right: 24,
          width: 340, height: 470,
          background: "#fff", borderRadius: 18,
          boxShadow: "0 20px 70px rgba(0,0,0,.28)",
          border: "1px solid rgba(99,102,241,.18)", zIndex: 299,
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: FONT_BODY,
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✨</div>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>Asistente Munich CRM</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.65)" }}>
                {escribiendo ? "Escribiendo…" : "Online · Listo para ayudarte"}
              </div>
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, background: "#f8fafc" }}>
            {mensajes.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "84%", padding: "9px 14px",
                  borderRadius: m.from === "user" ? "14px 3px 14px 14px" : "3px 14px 14px 14px",
                  background: m.from === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
                  color: m.from === "user" ? "#fff" : C.ink,
                  fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
                  boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {escribiendo && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ padding: "10px 16px", background: "#fff", borderRadius: "3px 14px 14px 14px", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
                  <span style={{ color: "#6366f1", fontWeight: 700, letterSpacing: 2 }}>···</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugerencias rápidas */}
          {mensajes.length <= 1 && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["¿Cómo asigno un vendedor?", "¿Cómo uso el seguimiento?", "¿Cómo veo reportes?"].map((s) => (
                <button key={s} onClick={() => { setInput(s); }}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#6366f1", cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
              placeholder="Preguntame algo…"
              style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: FONT_BODY, outline: "none", color: C.ink, background: "#f8fafc" }} />
            <button onClick={enviar} disabled={escribiendo}
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 16, fontWeight: 700, opacity: escribiendo ? 0.6 : 1 }}>
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// SIDEBAR — panel izquierdo oscuro con búsqueda
// ============================================================
function Sidebar({ contactos, activo, onSelect, onLogout, userEmail, userName, vista, setVista, alertas }) {
  const [filtro, setFiltro]   = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const lista = contactos.filter((c) => {
    const porEstado = filtro === "todos" || c.estado === filtro;
    const porBusq   = !busqueda
      || (c.nombre || "").toLowerCase().includes(busqueda.toLowerCase())
      || c.telefono.includes(busqueda);
    return porEstado && porBusq;
  });

  return (
    <div style={{ width: 340, minWidth: 340, background: D.bg, borderRight: `1px solid ${D.border}`, display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* Brand bar */}
      <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${D.border}`, background: "rgba(156,27,27,0.12)" }}>
        <div style={{ background: C.red, borderRadius: 11, padding: "6px 8px", display: "flex", alignItems: "center", boxShadow: `0 4px 14px rgba(156,27,27,.5)` }}>
          <img src={LOGO_URL} alt="NM" style={{ height: 30, objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: D.text, letterSpacing: 0.5, lineHeight: 1.1 }}>NUEVO MUNICH</div>
          <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: C.gold, marginTop: 3 }}>CRM · WhatsApp</div>
        </div>
        <AlertasBtn alertas={alertas} onSelect={(c) => { setVista("chat"); onSelect(c); }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${D.border}` }}>
        {[["chat","💬 Chats"], ["reportes","📊 Reportes"]].map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)}
            style={{
              flex: 1, border: "none", cursor: "pointer", padding: "12px 0",
              fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5,
              color: vista === k ? C.gold : D.muted,
              background: vista === k ? "rgba(212,161,58,.08)" : "transparent",
              borderBottom: vista === k ? `2px solid ${C.gold}` : "2px solid transparent",
              transition: "all .15s",
            }}>
            {l}
          </button>
        ))}
      </div>

      {vista === "chat" && (
        <>
          {/* Búsqueda */}
          <div style={{ padding: "11px 14px", borderBottom: `1px solid ${D.border}` }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: D.muted, fontSize: 13, pointerEvents: "none" }}>🔍</span>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o número…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 33px", borderRadius: 10, border: `1px solid ${D.border}`, fontSize: 13, fontFamily: FONT_BODY, background: D.surface, color: D.text, outline: "none" }} />
            </div>
          </div>

          {/* Filtros estado */}
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${D.border}`, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["todos", ...Object.keys(ESTADOS)].map((f) => {
              const active = filtro === f;
              return (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{
                    fontSize: 10, padding: "4px 10px", borderRadius: 6,
                    border: `1px solid ${active ? C.gold : D.border}`,
                    cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 700,
                    background: active ? C.gold : D.surface,
                    color: active ? C.charcoal : D.muted,
                    transition: "all .15s", textTransform: "uppercase", letterSpacing: 0.3,
                  }}>
                  {f === "todos" ? "TODOS" : ESTADOS[f].label}
                </button>
              );
            })}
          </div>

          {/* Lista contactos */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {lista.length === 0 && (
              <div style={{ padding: 32, color: D.muted, fontSize: 13.5, textAlign: "center" }}>
                {busqueda ? "Sin resultados 🔍" : "Sin conversaciones"}
              </div>
            )}
            {lista.map((c) => {
              const est  = ESTADOS[c.estado] || ESTADOS.nuevo;
              const sel  = activo?.id === c.id;
              const hora = c.updated_at
                ? new Date(c.updated_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                : "";
              return (
                <div key={c.id} onClick={() => onSelect(c)}
                  style={{
                    padding: "13px 14px", borderBottom: `1px solid ${D.border}`, cursor: "pointer",
                    display: "flex", gap: 12, alignItems: "flex-start",
                    background: sel ? D.active : "transparent",
                    borderLeft: sel ? `3px solid ${C.gold}` : "3px solid transparent",
                    transition: "background .12s",
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = D.hover; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar nombre={c.nombre || c.telefono} foto={c.foto_url} size={46} />
                    {!c.bot_activo && (
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: "50%", background: "#f59e0b", border: `2px solid ${D.bg}` }} title="Atendido por agente" />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: D.text, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                        {c.nombre || c.telefono}
                      </span>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 10.5, color: D.muted }}>{hora}</span>
                        {c.no_leidos > 0 && (
                          <span style={{ background: "#22c55e", color: "#fff", fontSize: 10, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", fontWeight: 800 }}>
                            {c.no_leidos}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: D.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>
                      {c.ultimo_msg || "—"}
                    </div>
                    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 4, background: est.bg, color: est.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                        {est.label}
                      </span>
                      {c.vendedor && <span style={{ fontSize: 10.5, color: C.gold, fontWeight: 600 }}>{c.vendedor}</span>}
                      {c.seguimiento_at && new Date(c.seguimiento_at) <= new Date() && <span title="Seguimiento vencido" style={{ fontSize: 12 }}>📌</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {vista === "reportes" && <div style={{ flex: 1 }} />}

      {/* Pie de usuario */}
      <div style={{ padding: "12px 14px", borderTop: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.red}, ${C.redDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0 }}>
          {(userName || "U")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
          <div style={{ fontSize: 10.5, color: D.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
        </div>
        <button onClick={onLogout} title="Cerrar sesión"
          style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.muted, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          ⎋
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CHAT PANEL — conversación completa
// ============================================================
function ChatPanel({ contacto, onUpdateContacto, userName }) {
  const [mensajes, setMensajes]   = useState([]);
  const [texto, setTexto]         = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [err, setErr]             = useState("");
  const [panelSeg, setPanelSeg]   = useState(false);
  const [drawerOpen, setDrawer]   = useState(false);
  const endRef = useRef(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("mensajes").select("*")
      .eq("contacto_id", contacto.id).order("created_at", { ascending: true });
    setMensajes(data || []);
    await supabase.from("contactos").update({ no_leidos: 0 }).eq("id", contacto.id);
  }, [contacto.id]);

  useEffect(() => {
    cargar();
    const ch = supabase.channel(`msg-${contacto.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `contacto_id=eq.${contacto.id}` },
        (p) => setMensajes((m) => m.some((x) => x.id === p.new.id) ? m : [...m, p.new]))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [contacto.id, cargar]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  const enviar = async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true); setErr(""); setTexto("");
    try {
      const { error } = await supabase.from("mensajes").insert({
        contacto_id: contacto.id, direccion: "out", origen: "agente",
        agente: userName, contenido: cuerpo,
      });
      if (error) throw error;
      const res = await fetch(N8N_SEND_WEBHOOK, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: contacto.telefono, mensaje: cuerpo, agente: userName }),
      });
      if (!res.ok) throw new Error("El mensaje se guardó pero falló el envío por WhatsApp.");
    } catch (e) {
      setErr(e.message || "Error al enviar.");
      setTexto(cuerpo);
    }
    setEnviando(false);
  };

  const upd = async (campos) => {
    await supabase.from("contactos").update(campos).eq("id", contacto.id);
    onUpdateContacto({ ...contacto, ...campos });
  };

  const est = ESTADOS[contacto.estado] || ESTADOS.nuevo;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", background: C.cream }}>
      {/* Cabecera del chat */}
      <div style={{
        padding: "11px 22px", borderBottom: `1px solid ${C.border}`,
        background: C.paper, display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={48} border={`2px solid ${C.gold}`} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600, color: C.charcoal }}>
                {contacto.nombre || contacto.telefono}
              </span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: est.bg, color: est.color, fontWeight: 700, textTransform: "uppercase" }}>
                {est.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {contacto.telefono}
              {contacto.empresa ? ` · ${contacto.empresa}` : ""}
            </div>
          </div>
          <button onClick={() => setDrawer(true)} title="Editar datos del contacto"
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 14, fontFamily: FONT_BODY, fontWeight: 600 }}>
            ✏️ Editar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={contacto.vendedor || ""} onChange={(e) => upd({ vendedor: e.target.value })} style={selStyle}>
            <option value="">Sin vendedor</option>
            {VENDEDORES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={contacto.estado} onChange={(e) => upd({ estado: e.target.value })} style={selStyle}>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => setPanelSeg((v) => !v)}
            style={{ ...btnToggleStyle, background: panelSeg ? C.gold : "#e5e7eb", color: panelSeg ? C.charcoal : C.muted }}>
            📌 Seguimiento
          </button>
          <button onClick={() => upd({ bot_activo: !contacto.bot_activo })}
            style={{ ...btnToggleStyle, background: contacto.bot_activo ? "#22c55e" : C.red, color: "#fff" }}>
            {contacto.bot_activo ? "🤖 Bot activo" : "✋ Atendido por mí"}
          </button>
        </div>
      </div>

      {/* Panel seguimiento */}
      {panelSeg && (
        <div style={{ background: "#fdf6e8", borderBottom: `1px solid ${C.border}`, padding: "12px 22px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>Próximo contacto</label>
            <input type="datetime-local" style={{ ...inp, width: 215 }}
              defaultValue={contacto.seguimiento_at ? new Date(contacto.seguimiento_at).toISOString().slice(0, 16) : ""}
              onChange={(e) => upd({ seguimiento_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={lbl}>Nota de seguimiento</label>
            <input style={inp} placeholder="Ej: confirmar pedido del finde"
              defaultValue={contacto.nota_seguimiento || ""}
              onBlur={(e) => upd({ nota_seguimiento: e.target.value })} />
          </div>
        </div>
      )}

      {/* Banner bot pausado */}
      {!contacto.bot_activo && (
        <div style={{ background: "#fef3c7", color: "#92400e", fontSize: 12.5, padding: "8px 22px", borderBottom: `1px solid ${C.border}`, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          ✋ <strong>Bot pausado.</strong> Tus mensajes van directo al cliente por WhatsApp.
        </div>
      )}

      {/* Mensajes */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "18px 22px",
        background: C.cream,
        backgroundImage: `radial-gradient(${C.border} 0.5px, transparent 0.5px)`,
        backgroundSize: "18px 18px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {mensajes.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 13.5, marginTop: 40 }}>
            No hay mensajes aún con este contacto.
          </div>
        )}
        {mensajes.map((m) => {
          const esCliente = m.direccion === "in";
          const esAgente  = m.origen === "agente";
          return (
            <div key={m.id} style={{ alignSelf: esCliente ? "flex-start" : "flex-end", maxWidth: "70%", display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Nombre remitente */}
              {esCliente && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 1 }}>
                  <Avatar nombre={contacto.nombre || contacto.telefono} foto={contacto.foto_url} size={20} border="none" />
                  <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 700 }}>
                    {contacto.nombre || contacto.telefono}
                  </span>
                </div>
              )}
              {/* Burbuja */}
              <div style={{
                background: esCliente ? "#fff" : esAgente ? "#f3dcdc" : "#fbeede",
                borderRadius: esCliente ? "3px 14px 14px 14px" : "14px 3px 14px 14px",
                borderLeft:  esCliente ? `3px solid ${C.border}` : "none",
                borderRight: !esCliente ? `3px solid ${esAgente ? C.red : C.gold}` : "none",
                padding: "10px 14px", fontSize: 14, color: C.ink,
                boxShadow: "0 1px 4px rgba(80,30,20,.08)", lineHeight: 1.5, whiteSpace: "pre-wrap",
              }}>
                {m.contenido}
              </div>
              {/* Meta */}
              <div style={{ fontSize: 10.5, color: C.muted, textAlign: esCliente ? "left" : "right", paddingLeft: esCliente ? 2 : 0, paddingRight: esCliente ? 0 : 2 }}>
                {!esCliente && (esAgente
                  ? <span style={{ color: C.red, fontWeight: 700 }}>{m.agente || "Agente"}</span>
                  : <span style={{ color: C.gold, fontWeight: 700 }}>Bot</span>)}
                {!esCliente ? " · " : ""}
                {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {err && (
        <div style={{ background: "#fee2e2", color: C.redDark, fontSize: 12.5, padding: "8px 22px", fontWeight: 600, borderTop: `1px solid ${C.border}` }}>
          ⚠️ {err}
        </div>
      )}

      {/* Input de mensaje */}
      <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.border}`, background: C.paper, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribí un mensaje… (Enter para enviar · Shift+Enter para nueva línea)"
          rows={1}
          style={{
            flex: 1, resize: "none", border: `1px solid ${C.border}`, borderRadius: 10,
            padding: "11px 14px", fontSize: 14, fontFamily: FONT_BODY, background: "#fff",
            color: C.ink, outline: "none", maxHeight: 120, lineHeight: 1.5,
          }} />
        <button onClick={enviar} disabled={enviando}
          style={{
            background: enviando ? C.muted : `linear-gradient(135deg, ${C.red}, ${C.redDark})`,
            color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px",
            fontSize: 14, fontWeight: 700, cursor: enviando ? "default" : "pointer",
            fontFamily: FONT_DISPLAY, letterSpacing: 0.5,
            boxShadow: enviando ? "none" : "0 2px 12px rgba(156,27,27,.35)",
            transition: "all .2s",
          }}>
          {enviando ? "…" : "Enviar ↑"}
        </button>
      </div>

      {/* Drawer de contacto */}
      {drawerOpen && (
        <ContactoDrawer
          contacto={contacto}
          onClose={() => setDrawer(false)}
          onSave={(updated) => { onUpdateContacto(updated); }}
        />
      )}
    </div>
  );
}

// ============================================================
// APP — raíz de la aplicación
// ============================================================
export default function App() {
  const [session,   setSession]   = useState(null);
  const [contactos, setContactos] = useState([]);
  const [activo,    setActivo]    = useState(null);
  const [vista,     setVista]     = useState("chat");
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const cargar = async () => {
      const { data } = await supabase.from("contactos").select("*").order("updated_at", { ascending: false });
      setContactos(data || []);
    };
    cargar();
    const ch = supabase.channel("contactos-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "contactos" }, cargar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [session]);

  const updateContacto = (c) => {
    setContactos((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    if (activo?.id === c.id) setActivo(c);
  };

  if (!ready) return null;
  if (!session) return (<><FontLoader /><Login /></>);

  const userEmail = session.user.email;
  const userName  = userEmail.split("@")[0].replace(/^\w/, (m) => m.toUpperCase());
  const alertas   = calcularAlertas(contactos);

  return (
    <div style={{ display: "flex", fontFamily: FONT_BODY, height: "100vh", overflow: "hidden" }}>
      <FontLoader />
      <Sidebar
        contactos={contactos} activo={activo} onSelect={setActivo}
        onLogout={() => supabase.auth.signOut()}
        userEmail={userEmail} userName={userName}
        vista={vista} setVista={setVista} alertas={alertas}
      />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {vista === "reportes" ? (
          <Reportes />
        ) : activo ? (
          <ChatPanel contacto={activo} onUpdateContacto={updateContacto} userName={userName} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.cream, flexDirection: "column", gap: 18 }}>
            <div style={{ width: 110, height: 110, borderRadius: 26, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 32px rgba(156,27,27,.4)` }}>
              <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 86, objectFit: "contain" }} />
            </div>
            <div style={{ color: C.charcoal, fontSize: 18, fontFamily: FONT_DISPLAY, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
              Nuevo Munich CRM
            </div>
            <div style={{ color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 320 }}>
              Seleccioná una conversación del panel izquierdo para empezar a atender
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
              {[["💬", "Conversaciones en tiempo real"], ["🤖", "Bot WhatsApp integrado"], ["📊", "Reportes y métricas"]].map(([icon, txt]) => (
                <div key={txt} style={{ padding: "10px 16px", background: C.paper, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span> {txt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <AIAsistente contactoActivo={activo} />
    </div>
  );
}

// ============================================================
// ESTILOS BASE
// ============================================================
const lbl = { display: "block", fontSize: 12, color: C.muted, marginTop: 14, marginBottom: 5, fontWeight: 700, letterSpacing: 0.3 };
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: FONT_BODY, background: "#fff", color: C.ink, outline: "none" };
const btnToggleStyle = { border: "none", borderRadius: 7, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY, transition: "all .2s" };
const selStyle = { border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 12.5, fontFamily: FONT_BODY, background: "#fff", color: C.ink, cursor: "pointer", fontWeight: 500 };
