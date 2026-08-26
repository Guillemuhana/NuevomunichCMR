// ============================================================
// NOTAS — el pizarrón compartido de Administración
// ------------------------------------------------------------
// Recordatorios y apuntes del día a día: "llamar al proveedor",
// "el martes no hay reparto", "Franco pidió factura A".
//
// Son compartidas a propósito: si administración son dos personas,
// las dos ven lo mismo y se enteran al toque, sin recargar.
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  StickyNote, Plus, X, Check, Trash2, Pin, Search, Calendar, Clock,
} from "lucide-react";
import { supabase, C, L, R, SH, FONT_DISPLAY, FONT_BODY } from "./lib";

// Colores del papelito. Pensados para leerse bien, no para gritar.
const COLORES = {
  amarillo: { bg: "#FFFBEB", borde: "#FDE68A", punto: "#F59E0B", label: "Amarillo" },
  verde:    { bg: "#F0FDF4", borde: "#BBF7D0", punto: "#22C55E", label: "Verde" },
  azul:     { bg: "#EFF6FF", borde: "#BFDBFE", punto: "#3B82F6", label: "Azul" },
  rosa:     { bg: "#FDF2F8", borde: "#FBCFE8", punto: "#EC4899", label: "Rosa" },
  gris:     { bg: "#F8FAFC", borde: "#E2E8F0", punto: "#94A3B8", label: "Gris" },
};
const colorDe = (c) => COLORES[c] || COLORES.amarillo;

const hoyISO = () => new Date().toISOString().slice(0, 10);

function cuandoRecordatorio(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha + "T12:00");
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const dias = Math.round((d - hoy) / 86400000);
  if (dias < 0)  return { texto: `Venció ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"} atrás`, tono: "vencido" };
  if (dias === 0) return { texto: "Es hoy", tono: "hoy" };
  if (dias === 1) return { texto: "Mañana", tono: "pronto" };
  if (dias <= 7)  return { texto: `En ${dias} días`, tono: "pronto" };
  return { texto: d.toLocaleDateString("es-AR", { day: "2-digit", month: "long" }), tono: "lejos" };
}

const TONO = {
  vencido: { color: "#B42318", bg: "#FEE4E2" },
  hoy:     { color: "#B45309", bg: "#FEF3C7" },
  pronto:  { color: "#1D4ED8", bg: "#DBEAFE" },
  lejos:   { color: L.muted,   bg: L.soft },
};

export default function Notas({ userName, userEmail, isMobile }) {
  const [notas, setNotas]       = useState([]);
  const [cargando, setCargando] = useState(true);
  const [falta, setFalta]       = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [verHechas, setVerHechas] = useState(false);
  const [editando, setEditando] = useState(null);   // {} = nueva | fila = editar

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("notas").select("*")
      .order("fijada", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error?.message?.includes("does not exist")) { setFalta(true); setCargando(false); return; }
    setNotas(data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Si son dos personas mirando el pizarrón, que vean lo mismo.
  useEffect(() => {
    const ch = supabase.channel("notas-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "notas" }, cargar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [cargar]);

  const alternar = async (nota, campo) => {
    await supabase.from("notas").update({ [campo]: !nota[campo] }).eq("id", nota.id);
    cargar();
  };

  const borrar = async (nota) => {
    if (!window.confirm("¿Borrar esta nota?")) return;
    await supabase.from("notas").delete().eq("id", nota.id);
    cargar();
  };

  const visibles = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    return notas.filter((n) => {
      if (!verHechas && n.hecha) return false;
      if (!b) return true;
      return (n.titulo || "").toLowerCase().includes(b) || (n.texto || "").toLowerCase().includes(b);
    });
  }, [notas, busqueda, verHechas]);

  const pendientes = notas.filter((n) => !n.hecha).length;
  const hechas     = notas.filter((n) => n.hecha).length;
  const vencidas   = notas.filter((n) => !n.hecha && n.recordatorio && n.recordatorio < hoyISO()).length;

  if (falta) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: L.bg, padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: "center", background: L.white, border: `1px solid ${L.border}`, borderRadius: R.lg, padding: 30, boxShadow: SH.sm }}>
          <StickyNote size={28} color={C.red} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text, margin: "14px 0 8px" }}>
            Falta preparar la base
          </div>
          <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.6 }}>
            La tabla de notas todavía no existe. Abrí el <strong>SQL Editor</strong> de Supabase y
            ejecutá <strong>supabase_notas.sql</strong>, que está en la raíz del proyecto.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-y" style={{ flex: 1, overflowY: "auto", background: L.bg, padding: isMobile ? "16px 14px" : "26px 30px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Encabezado */}
        <div className="barra-acciones" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 19 : 23, color: L.text, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <StickyNote size={isMobile ? 19 : 22} color={C.red} /> Notas
            </h1>
            <div style={{ fontSize: 13, color: L.muted, marginTop: 5 }}>
              {pendientes === 0 && hechas === 0
                ? "Apuntes y recordatorios del equipo."
                : <>
                    {pendientes} pendiente{pendientes === 1 ? "" : "s"}
                    {vencidas > 0 && <span style={{ color: "#B42318", fontWeight: 600 }}> · {vencidas} vencida{vencidas === 1 ? "" : "s"}</span>}
                  </>}
            </div>
          </div>
          <button onClick={() => setEditando({})}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: R.sm, background: C.red, color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer", boxShadow: SH.xs }}>
            <Plus size={16} /> Nueva nota
          </button>
        </div>

        {/* Buscar + ver hechas */}
        {(notas.length > 0) && (
          <div className="barra-acciones" style={{ marginBottom: 16, gap: 8 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search size={14} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en las notas…"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 33px", borderRadius: R.sm, border: `1px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, background: L.white, color: L.text, outline: "none" }} />
            </div>
            {hechas > 0 && (
              <button onClick={() => setVerHechas((v) => !v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: R.sm, border: `1px solid ${verHechas ? C.red : L.border}`, background: verHechas ? C.redSoft : L.white, color: verHechas ? C.red : L.muted, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Check size={14} /> Hechas ({hechas})
              </button>
            )}
          </div>
        )}

        {/* El pizarrón */}
        {cargando ? (
          <div style={{ padding: 60, textAlign: "center", color: L.light, fontSize: 13.5 }}>Cargando…</div>
        ) : visibles.length === 0 ? (
          <div style={{ background: L.white, border: `1px dashed ${L.border}`, borderRadius: R.lg, padding: "48px 30px", textAlign: "center" }}>
            <StickyNote size={30} color={L.light} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text, margin: "14px 0 8px" }}>
              {busqueda ? "No encontré nada" : "El pizarrón está vacío"}
            </div>
            <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.6, maxWidth: 400, margin: "0 auto 20px" }}>
              {busqueda
                ? "Probá con otra palabra."
                : "Anotá lo que no se puede olvidar: llamados por hacer, avisos para el resto del equipo, pendientes del día."}
            </div>
            {!busqueda && (
              <button onClick={() => setEditando({})}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: R.sm, background: C.red, color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}>
                <Plus size={16} /> Escribir la primera
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 240 : 270}px, 1fr))`, gap: 12, alignItems: "start" }}>
            {visibles.map((n) => (
              <TarjetaNota key={n.id} nota={n}
                onEditar={() => setEditando(n)}
                onFijar={() => alternar(n, "fijada")}
                onHecha={() => alternar(n, "hecha")}
                onBorrar={() => borrar(n)} />
            ))}
          </div>
        )}
      </div>

      {editando && (
        <ModalNota nota={editando} userName={userName} userEmail={userEmail}
          onCerrar={() => setEditando(null)}
          onGuardada={() => { setEditando(null); cargar(); }} />
      )}
    </div>
  );
}

// ── Un papelito ─────────────────────────────────────────────
function TarjetaNota({ nota, onEditar, onFijar, onHecha, onBorrar }) {
  const col = colorDe(nota.color);
  const rec = cuandoRecordatorio(nota.recordatorio);
  const tono = rec ? TONO[rec.tono] : null;

  return (
    <div style={{
      background: nota.hecha ? L.soft : col.bg,
      border: `1px solid ${nota.hecha ? L.border : col.borde}`,
      borderRadius: R.md, padding: "13px 15px", fontFamily: FONT_BODY,
      display: "flex", flexDirection: "column", gap: 8,
      opacity: nota.hecha ? 0.62 : 1, boxShadow: SH.xs,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button onClick={onHecha} title={nota.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
          style={{ flexShrink: 0, marginTop: 1, width: 19, height: 19, borderRadius: 6, cursor: "pointer",
            border: `1.5px solid ${nota.hecha ? "#15803D" : col.punto}`,
            background: nota.hecha ? "#15803D" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          {nota.hecha && <Check size={12} color="#fff" />}
        </button>

        <div onClick={onEditar} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          {nota.titulo && (
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: L.text, marginBottom: 3, textDecoration: nota.hecha ? "line-through" : "none" }}>
              {nota.titulo}
            </div>
          )}
          <div style={{ fontSize: 13, color: L.text, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", textDecoration: nota.hecha ? "line-through" : "none" }}>
            {nota.texto}
          </div>
        </div>

        <button onClick={onFijar} title={nota.fijada ? "Desfijar" : "Fijar arriba"}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 2, color: nota.fijada ? C.red : L.light }}>
          <Pin size={14} fill={nota.fijada ? C.red : "none"} />
        </button>
      </div>

      {rec && !nota.hecha && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", background: tono.bg, color: tono.color, borderRadius: R.pill, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>
          <Clock size={11} /> {rec.texto}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2, fontSize: 10.5, color: L.light }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nota.autor || "—"} · {new Date(nota.updated_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
        </span>
        <button onClick={onBorrar} title="Borrar"
          style={{ background: "none", border: "none", cursor: "pointer", color: L.light, padding: 2, flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Escribir o editar ───────────────────────────────────────
function ModalNota({ nota, userName, userEmail, onCerrar, onGuardada }) {
  const nueva = !nota?.id;
  const [titulo, setTitulo] = useState(nota?.titulo || "");
  const [texto, setTexto]   = useState(nota?.texto || "");
  const [color, setColor]   = useState(nota?.color || "amarillo");
  const [recordatorio, setRecordatorio] = useState(nota?.recordatorio || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError]   = useState("");
  const areaRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  const guardar = async () => {
    if (!texto.trim() && !titulo.trim()) { setError("Escribí algo antes de guardar."); return; }
    setGuardando(true); setError("");
    const fila = {
      titulo: titulo.trim() || null,
      texto: texto.trim(),
      color,
      recordatorio: recordatorio || null,
    };
    const { error: e } = nueva
      ? await supabase.from("notas").insert({ ...fila, autor: userName || null, autor_email: userEmail || null })
      : await supabase.from("notas").update(fila).eq("id", nota.id);
    setGuardando(false);
    if (e) { setError(e.message); return; }
    onGuardada();
  };

  const col = colorDe(color);

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", backdropFilter: "blur(3px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 480, background: col.bg, border: `1px solid ${col.borde}`, borderRadius: R.xl, boxShadow: SH.xl, fontFamily: FONT_BODY, overflow: "hidden" }}>

        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${col.borde}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: L.text }}>
            {nueva ? "Nueva nota" : "Editar nota"}
          </div>
          <button onClick={onCerrar}
            style={{ background: "rgba(255,255,255,.7)", border: `1px solid ${col.borde}`, borderRadius: R.sm, width: 30, height: 30, cursor: "pointer", color: L.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <input autoFocus={nueva} value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (opcional)"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: R.sm, border: `1px solid ${col.borde}`, background: "rgba(255,255,255,.75)", fontSize: 14.5, fontWeight: 700, fontFamily: FONT_DISPLAY, color: L.text, outline: "none" }} />

          <textarea ref={areaRef} value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder="Escribí lo que no se puede olvidar…"
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: R.sm, border: `1px solid ${col.borde}`, background: "rgba(255,255,255,.75)", fontSize: 13.5, fontFamily: FONT_BODY, color: L.text, outline: "none", resize: "vertical", lineHeight: 1.55 }} />

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {Object.entries(COLORES).map(([k, c]) => (
                <button key={k} onClick={() => setColor(k)} title={c.label}
                  style={{ width: 22, height: 22, borderRadius: "50%", background: c.punto, cursor: "pointer",
                    border: color === k ? `2.5px solid ${L.text}` : "2.5px solid transparent", padding: 0 }} />
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto", fontSize: 12.5, color: L.muted, fontWeight: 600 }}>
              <Calendar size={14} />
              <input type="date" value={recordatorio} onChange={(e) => setRecordatorio(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: R.sm, border: `1px solid ${col.borde}`, background: "rgba(255,255,255,.75)", fontSize: 12.5, fontFamily: FONT_BODY, color: L.text, outline: "none" }} />
              {recordatorio && (
                <button onClick={() => setRecordatorio("")} title="Sacar el recordatorio"
                  style={{ background: "none", border: "none", cursor: "pointer", color: L.light, padding: 0 }}>
                  <X size={13} />
                </button>
              )}
            </label>
          </div>

          {error && <div style={{ fontSize: 12.5, color: C.redDark }}>{error}</div>}
        </div>

        <div style={{ padding: "13px 20px", borderTop: `1px solid ${col.borde}`, display: "flex", justifyContent: "flex-end", gap: 9, background: "rgba(255,255,255,.45)" }}>
          <button onClick={onCerrar}
            style={{ padding: "9px 16px", borderRadius: R.sm, border: `1px solid ${col.borde}`, background: "rgba(255,255,255,.8)", color: L.muted, fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: "9px 20px", borderRadius: R.sm, border: "none", background: C.red, color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.65 : 1 }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
