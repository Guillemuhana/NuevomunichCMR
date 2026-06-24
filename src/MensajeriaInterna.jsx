import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase, C, FONT_DISPLAY, FONT_BODY, getContactosInternos } from "./lib";

const L = {
  bg: "#F5F6F8", white: "#FFFFFF", border: "#E4E8ED",
  text: "#0F172A", muted: "#64748B", light: "#94A3B8", soft: "#F1F5F9",
};

// Avatar con iniciales
function Ini({ nombre, size = 38, activo }) {
  const ini = (nombre || "?").trim().slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: activo ? C.red : "#E2E8F0", color: activo ? "#fff" : L.muted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size * 0.38 }}>
      {ini}
    </div>
  );
}

// ── Panel de conversaciones internas ──
function PanelMensajeria({ self, onClose, onLeer }) {
  const contactos = getContactosInternos(self.key);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState("");
  const [noLeidos, setNoLeidos] = useState({}); // { de_key: count }
  const endRef = useRef(null);

  const cargarNoLeidos = useCallback(async () => {
    const { data } = await supabase.from("mensajes_internos")
      .select("de_key").eq("para_key", self.key).eq("leido", false);
    const map = {};
    (data || []).forEach(m => { map[m.de_key] = (map[m.de_key] || 0) + 1; });
    setNoLeidos(map);
    onLeer?.();
  }, [self.key, onLeer]);

  const cargarConversacion = useCallback(async (c) => {
    if (!c) return;
    const { data } = await supabase.from("mensajes_internos").select("*")
      .or(`and(de_key.eq.${self.key},para_key.eq.${c.key}),and(de_key.eq.${c.key},para_key.eq.${self.key})`)
      .order("created_at", { ascending: true });
    setMsgs(data || []);
    await supabase.from("mensajes_internos").update({ leido: true })
      .eq("de_key", c.key).eq("para_key", self.key).eq("leido", false);
    cargarNoLeidos();
  }, [self.key, cargarNoLeidos]);

  useEffect(() => { cargarNoLeidos(); }, [cargarNoLeidos]);
  useEffect(() => { if (sel) cargarConversacion(sel); }, [sel, cargarConversacion]);

  useEffect(() => {
    const ch = supabase.channel(`mi-panel-${self.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes_internos" }, () => {
        cargarNoLeidos();
        if (sel) cargarConversacion(sel);
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, [self.key, sel, cargarNoLeidos, cargarConversacion]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !sel) return;
    setTexto("");
    const { data } = await supabase.from("mensajes_internos").insert({
      de_key: self.key, de_nombre: self.nombre, para_key: sel.key, texto: t,
    }).select().single();
    if (data) setMsgs(m => [...m, data]);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 500 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(820px, 96vw)", height: "min(620px, 92vh)", background: L.white, borderRadius: 18, zIndex: 501, boxShadow: "0 24px 80px rgba(0,0,0,.3)", fontFamily: FONT_BODY, display: "flex", overflow: "hidden" }}>

        {/* Lista de contactos */}
        <div style={{ width: 260, borderRight: `1px solid ${L.border}`, display: "flex", flexDirection: "column", flexShrink: 0, background: L.soft }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${L.border}`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: L.text, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={17} color={C.red} /> Mensajes
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {contactos.map(c => {
              const on = sel?.key === c.key;
              const nl = noLeidos[c.key] || 0;
              return (
                <button key={c.key} onClick={() => setSel(c)}
                  style={{ width: "100%", border: "none", cursor: "pointer", padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, background: on ? L.white : "transparent", borderLeft: on ? `3px solid ${C.red}` : "3px solid transparent", textAlign: "left" }}>
                  <Ini nombre={c.nombre} activo={on} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 700 : 600, color: on ? C.red : L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</span>
                  {nl > 0 && <span style={{ background: "#22C55E", color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 10, minWidth: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{nl}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversación */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "13px 18px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
            {sel ? <><Ini nombre={sel.nombre} size={34} activo /><span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: L.text }}>{sel.nombre}</span></>
                 : <span style={{ color: L.muted, fontSize: 14 }}>Elegí con quién hablar</span>}
            <button onClick={onClose} style={{ marginLeft: "auto", background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
              <X size={17} />
            </button>
          </div>

          <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "16px 18px", background: L.bg, display: "flex", flexDirection: "column", gap: 8 }}>
            {!sel ? (
              <div style={{ margin: "auto", color: L.light, fontSize: 14, textAlign: "center" }}>Seleccioná un contacto a la izquierda para empezar a chatear.</div>
            ) : msgs.length === 0 ? (
              <div style={{ margin: "auto", color: L.light, fontSize: 13.5 }}>Sin mensajes todavía. ¡Escribí el primero!</div>
            ) : msgs.map(m => {
              const mio = m.de_key === self.key;
              return (
                <div key={m.id} style={{ alignSelf: mio ? "flex-end" : "flex-start", maxWidth: "72%", background: mio ? C.red : L.white, color: mio ? "#fff" : L.text, borderRadius: mio ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "9px 13px", fontSize: 14, lineHeight: 1.45, boxShadow: "0 1px 4px rgba(0,0,0,.07)", whiteSpace: "pre-wrap", border: mio ? "none" : `1px solid ${L.border}` }}>
                  {m.texto}
                  <div style={{ fontSize: 10, marginTop: 4, color: mio ? "rgba(255,255,255,.7)" : L.light, textAlign: "right" }}>
                    {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {sel && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${L.border}`, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, background: L.white }}>
              <textarea value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Escribí un mensaje…" rows={1}
                style={{ flex: 1, resize: "none", border: `1.5px solid ${L.border}`, borderRadius: 11, padding: "11px 14px", fontSize: 14, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none", maxHeight: 110, lineHeight: 1.4 }} />
              <button onClick={enviar}
                style={{ background: C.red, color: "#fff", border: "none", borderRadius: 11, width: 44, height: 44, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Botón "Mensajes" con badge de no leídos ──
export default function BotonMensajes({ self, compact }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const cargarUnread = useCallback(async () => {
    const { count } = await supabase.from("mensajes_internos")
      .select("id", { count: "exact", head: true })
      .eq("para_key", self.key).eq("leido", false);
    setUnread(count || 0);
  }, [self.key]);

  useEffect(() => {
    cargarUnread();
    const ch = supabase.channel(`mi-badge-${self.key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes_internos" }, cargarUnread)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [cargarUnread]);

  return (
    <>
      <button onClick={() => setOpen(true)} title="Mensajes internos"
        style={{ position: "relative", display: "flex", alignItems: "center", gap: compact ? 0 : 8, background: L.white, border: `1.5px solid ${L.border}`, color: C.red, borderRadius: 10, padding: compact ? 0 : "0 14px", width: compact ? 38 : undefined, height: 38, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: 0.3, justifyContent: "center" }}>
        <MessageCircle size={17} />
        {!compact && "Mensajes"}
        {unread > 0 && (
          <span style={{ position: "absolute", top: -6, right: -6, background: "#22C55E", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${L.white}` }}>{unread}</span>
        )}
      </button>
      {open && <PanelMensajeria self={self} onClose={() => { setOpen(false); cargarUnread(); }} onLeer={cargarUnread} />}
    </>
  );
}
