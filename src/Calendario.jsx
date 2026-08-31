import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, MapPin,
  Users, Truck, Bell, FileText, Calendar as CalIcon, Loader2,
  Share2, Download, Copy, Check,
} from "lucide-react";
import { supabase, C, L, R, SH, FONT_DISPLAY, FONT_BODY, VENDEDORES_INFO } from "./lib";
import { compartirEvento, descargarICS, textoEvento } from "./compartir";

// ── Tipos de evento ─────────────────────────────────────────
export const TIPOS_EVENTO = {
  reunion:      { label: "Reunión",      color: "#A81F1F", bg: "#FDF2F2", Icon: Users },
  visita:       { label: "Visita",       color: "#2A4E8F", bg: "#EEF3FB", Icon: MapPin },
  entrega:      { label: "Entrega",      color: "#2F6B46", bg: "#EDF6F0", Icon: Truck },
  recordatorio: { label: "Recordatorio", color: "#8A5A22", bg: "#FBF3E8", Icon: Bell },
  otro:         { label: "Otro",         color: "#667085", bg: "#F4F6F8", Icon: FileText },
};
const tipoDe = (t) => TIPOS_EVENTO[t] || TIPOS_EVENTO.otro;

// Constante, no un literal por render: si no, los useMemo que dependen de
// `pedidos` se recalculan siempre en las pantallas que no los pasan.
const SIN_PEDIDOS = [];

const VISTAS = [
  { k: "dayGridMonth", label: "Mes" },
  { k: "timeGridWeek", label: "Semana" },
  { k: "timeGridDay",  label: "Día" },
];

// ── Estilos base de FullCalendar, reducidos a lo esencial ───
const CAL_CSS = `
.mn-cal { --fc-border-color: ${L.border}; --fc-page-bag-color: ${L.white};
  --fc-today-bg-color: ${C.redSoft}; --fc-now-indicator-color: ${C.red};
  --fc-small-font-size: 12px; font-family: ${FONT_BODY}; height: 100%; }
.mn-cal .fc-scrollgrid { border-radius: ${R.lg}px; overflow: hidden; background: ${L.white}; }
.mn-cal .fc-scrollgrid, .mn-cal .fc-scrollgrid td, .mn-cal .fc-scrollgrid th { border-color: ${L.border}; }
.mn-cal .fc-col-header-cell {
  background: ${L.white}; padding: 10px 0; font-family: ${FONT_DISPLAY};
  font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${L.light}; }
.mn-cal .fc-col-header-cell-cushion { text-decoration: none; color: inherit; }
.mn-cal .fc-daygrid-day-number { font-size: 12.5px; font-weight: 500; color: ${L.muted}; padding: 7px 9px; text-decoration: none; }
.mn-cal .fc-day-today .fc-daygrid-day-number { color: ${C.red}; font-weight: 700; }
.mn-cal .fc-day-other .fc-daygrid-day-number { color: ${L.light}; opacity: .55; }
.mn-cal .fc-daygrid-day.fc-day-today { background: ${C.redSoft}; }
.mn-cal .fc-daygrid-day:hover { background: ${L.soft}; transition: background .12s; }
.mn-cal .fc-daygrid-day.fc-day-today:hover { background: ${C.redSoft}; }
.mn-cal .fc-event { border: none; background: transparent; box-shadow: none; padding: 0 2px 2px; cursor: pointer; }
.mn-cal .fc-event-main { border-radius: ${R.xs}px; }
.mn-cal .fc-timegrid-slot { height: 2.4em; }
.mn-cal .fc-timegrid-slot-label-cushion { font-size: 11px; color: ${L.light}; }
.mn-cal .fc-timegrid-axis-cushion { font-size: 10px; color: ${L.light}; }
.mn-cal .fc-daygrid-more-link { font-size: 11px; font-weight: 600; color: ${C.red}; padding: 1px 6px; }
.mn-cal .fc-highlight { background: ${C.redSoft}; }
.mn-cal a { text-decoration: none; }

/* Celular: la grilla del mes entra igual, pero con todo un punto mas chico.
   Con los tamanos de escritorio los nombres de los dias se pisaban unos con
   otros y los numeros no entraban en la celda. */
@media (max-width: 640px) {
  .mn-cal .fc-col-header-cell { padding: 7px 0; font-size: 9.5px; letter-spacing: .04em; }
  .mn-cal .fc-daygrid-day-number { font-size: 11.5px; padding: 4px 5px; }
  .mn-cal .fc-event { padding: 0 1px 1px; }
  .mn-cal .fc-daygrid-more-link { font-size: 10px; padding: 1px 4px; }
  .mn-cal .fc-timegrid-slot-label-cushion { font-size: 10px; }
}
.mn-fade-in { animation: mnFade .18s ease-out; }
@keyframes mnFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes mnSpin { to { transform: rotate(360deg); } }
`;

// ── Helpers de fecha ────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const desdeInputs = (fecha, hora) => new Date(`${fecha}T${hora || "00:00"}:00`);

// ============================================================
// CHIP DE TIPO
// ============================================================
function ChipTipo({ tipo, activo, onClick, size = "md" }) {
  const t = tipoDe(tipo);
  const chico = size === "sm";
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        padding: chico ? "5px 11px" : "7px 14px", borderRadius: R.sm,
        border: `1px solid ${activo ? t.color + "55" : L.border}`,
        background: activo ? t.bg : L.white, color: activo ? t.color : L.muted,
        fontSize: chico ? 11.5 : 12.5, fontWeight: 600, transition: "all .15s", whiteSpace: "nowrap",
      }}>
      {/* Una barrita en vez del puntito redondo: el círculo de color hacía
          ver la barra de filtros como una fila de caramelos. */}
      <span style={{ width: 3, height: chico ? 11 : 13, borderRadius: 2, background: t.color, opacity: activo ? 1 : .35 }} />
      {t.label}
    </button>
  );
}

// ============================================================
// MODAL DE EVENTO (crear / editar)
// ============================================================
function ModalEvento({ evento, onClose, onGuardado, onEliminado, userEmail }) {
  const nuevo = !evento?.id;
  const ini = evento?.inicio ? new Date(evento.inicio) : new Date();
  const fin = evento?.fin ? new Date(evento.fin) : new Date(ini.getTime() + 60 * 60 * 1000);

  const [titulo, setTitulo]       = useState(evento?.titulo || "");
  const [tipo, setTipo]           = useState(evento?.tipo || "reunion");
  const [todoDia, setTodoDia]     = useState(!!evento?.todo_el_dia);
  const [fecha, setFecha]         = useState(toDateInput(ini));
  const [hora, setHora]           = useState(toTimeInput(ini));
  const [fechaFin, setFechaFin]   = useState(toDateInput(fin));
  const [horaFin, setHoraFin]     = useState(toTimeInput(fin));
  const [lugar, setLugar]         = useState(evento?.lugar || "");
  const [vendedor, setVendedor]   = useState(evento?.vendedor || "");
  const [descripcion, setDesc]    = useState(evento?.descripcion || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [aviso, setAviso]         = useState("");   // feedback de compartir/copiar

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const guardar = async () => {
    if (!titulo.trim()) { setError("Poné un título para el evento."); return; }
    setGuardando(true); setError("");
    const inicioTs = todoDia ? desdeInputs(fecha, "00:00") : desdeInputs(fecha, hora);
    const finTs    = todoDia ? null : desdeInputs(fechaFin || fecha, horaFin);
    if (finTs && finTs <= inicioTs) { setGuardando(false); setError("El fin tiene que ser posterior al inicio."); return; }

    const fila = {
      titulo: titulo.trim(), tipo, todo_el_dia: todoDia,
      inicio: inicioTs.toISOString(), fin: finTs ? finTs.toISOString() : null,
      lugar: lugar.trim() || null, vendedor: vendedor || null,
      descripcion: descripcion.trim() || null,
    };
    const q = nuevo
      ? supabase.from("eventos").insert({ ...fila, creado_por: userEmail || null }).select().single()
      : supabase.from("eventos").update(fila).eq("id", evento.id).select().single();
    const { data, error: err } = await q;
    setGuardando(false);
    if (err) { setError(err.message); return; }
    onGuardado(data);
  };

  // ── Compartir el evento ──────────────────────────────────
  // El evento tal cual está guardado (no lo que hay en el formulario
  // sin guardar), así lo que se comparte es lo que realmente pasa.
  const compartir = async () => {
    const donde = await compartirEvento(evento);
    setAviso(donde === "copiado" ? "Copiado al portapapeles" : donde === "whatsapp" ? "Abriendo WhatsApp…" : "");
    setTimeout(() => setAviso(""), 2200);
  };

  const copiar = async () => {
    await navigator.clipboard?.writeText(textoEvento(evento));
    setAviso("Copiado al portapapeles");
    setTimeout(() => setAviso(""), 2200);
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar este evento?")) return;
    setGuardando(true);
    const { error: err } = await supabase.from("eventos").delete().eq("id", evento.id);
    setGuardando(false);
    if (err) { setError(err.message); return; }
    onEliminado(evento.id);
  };

  const inputSt = {
    width: "100%", padding: "10px 12px", borderRadius: R.sm, border: `1px solid ${L.border}`,
    fontSize: 14, fontFamily: FONT_BODY, color: L.text, background: L.white, outline: "none",
  };
  const labelSt = {
    display: "block", marginBottom: 6, fontSize: 11, fontWeight: 600, color: L.muted,
    fontFamily: FONT_DISPLAY, letterSpacing: ".06em", textTransform: "uppercase",
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.42)", backdropFilter: "blur(3px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="mn-fade-in" style={{ width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", background: L.white, borderRadius: R.xl, boxShadow: SH.xl, border: `1px solid ${L.border}` }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 14px", borderBottom: `1px solid ${L.border}`, position: "sticky", top: 0, background: L.white, borderRadius: `${R.xl}px ${R.xl}px 0 0` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-.01em", color: L.text }}>
            {nuevo ? "Nuevo evento" : "Editar evento"}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: L.light, padding: 4, display: "flex", borderRadius: R.xs }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelSt}>Título</label>
            <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Visita a cliente" style={{ ...inputSt, fontSize: 15, fontWeight: 500 }} />
          </div>

          <div>
            <label style={labelSt}>Tipo</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {Object.keys(TIPOS_EVENTO).map((k) => (
                <ChipTipo key={k} tipo={k} activo={tipo === k} onClick={() => setTipo(k)} size="sm" />
              ))}
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13.5, color: L.text, fontWeight: 500 }}>
            <input type="checkbox" checked={todoDia} onChange={(e) => setTodoDia(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.red, cursor: "pointer" }} />
            Todo el día
          </label>

          <div style={{ display: "grid", gridTemplateColumns: todoDia ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>{todoDia ? "Fecha" : "Inicio"}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); if (!fechaFin || fechaFin < e.target.value) setFechaFin(e.target.value); }} style={inputSt} />
                {!todoDia && <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...inputSt, width: 108 }} />}
              </div>
            </div>
            {!todoDia && (
              <div>
                <label style={labelSt}>Fin</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={inputSt} />
                  <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} style={{ ...inputSt, width: 108 }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Lugar</label>
              <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Opcional" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Vendedor</label>
              <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
                <option value="">Todos</option>
                {VENDEDORES_INFO.map((v) => (
                  <option key={v.emailPrefix} value={v.alias || v.nombre}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelSt}>Nota</label>
            <textarea value={descripcion} onChange={(e) => setDesc(e.target.value)} rows={3}
              placeholder="Detalles del evento (opcional)" style={{ ...inputSt, resize: "vertical", lineHeight: 1.5 }} />
          </div>

          {aviso && (
            <div style={{ padding: "9px 12px", borderRadius: R.sm, background: "#F0FDF4", color: "#15803D", fontSize: 13, border: "1px solid #BBF7D0" }}>
              {aviso}
            </div>
          )}
          {error && (
            <div style={{ padding: "9px 12px", borderRadius: R.sm, background: C.redSoft, color: C.redDark, fontSize: 13, border: `1px solid ${C.red}22` }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 22px", borderTop: `1px solid ${L.border}`, position: "sticky", bottom: 0, background: L.white }}>
          {!nuevo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <button onClick={compartir} disabled={guardando} title="Compartir este evento"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: R.sm, border: `1px solid ${C.red}`, background: C.redSoft, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <Share2 size={15} /> Compartir
              </button>
              <button onClick={copiar} disabled={guardando} title="Copiar el texto del evento"
                style={{ display: "inline-flex", alignItems: "center", padding: "9px 10px", borderRadius: R.sm, border: `1px solid ${L.border}`, background: L.white, color: L.muted, cursor: "pointer" }}>
                {aviso === "Copiado al portapapeles" ? <Check size={15} color="#15803D" /> : <Copy size={15} />}
              </button>
              <button onClick={() => descargarICS(evento)} disabled={guardando} title="Bajar el .ics para Google Calendar o el iPhone"
                style={{ display: "inline-flex", alignItems: "center", padding: "9px 10px", borderRadius: R.sm, border: `1px solid ${L.border}`, background: L.white, color: L.muted, cursor: "pointer" }}>
                <Download size={15} />
              </button>
              <button onClick={eliminar} disabled={guardando} title="Eliminar el evento"
                style={{ display: "inline-flex", alignItems: "center", padding: "9px 10px", borderRadius: R.sm, border: `1px solid ${L.border}`, background: L.white, color: C.red, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ) : <span />}
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={onClose} disabled={guardando}
              style={{ padding: "10px 16px", borderRadius: R.sm, border: `1px solid ${L.border}`, background: L.white, color: L.muted, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: R.sm, border: "none", background: C.red, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: guardando ? "default" : "pointer", opacity: guardando ? .7 : 1, boxShadow: SH.xs }}>
              {guardando && <Loader2 size={15} style={{ animation: "mnSpin .9s linear infinite" }} />}
              {nuevo ? "Crear evento" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PANEL DE CALENDARIO
// ============================================================
export default function Calendario({ userEmail, isMobile, vendedorFijo, pedidos = SIN_PEDIDOS }) {
  const calRef = useRef(null);
  const [eventos, setEventos]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista]       = useState(isMobile ? "timeGridDay" : "dayGridMonth");
  const [titulo, setTitulo]     = useState("");
  const [modal, setModal]       = useState(null);   // { ...evento } | { inicio } | null
  const [filtros, setFiltros]   = useState([]);     // tipos activos; vacío = todos

  // ── Carga inicial + realtime ──
  const cargar = useCallback(async () => {
    let q = supabase.from("eventos").select("*").order("inicio", { ascending: true });
    if (vendedorFijo) q = q.or(`vendedor.eq.${vendedorFijo},vendedor.is.null`);
    const { data, error } = await q;
    if (!error) setEventos(data || []);
    setCargando(false);
  }, [vendedorFijo]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const ch = supabase.channel("eventos-cal")
      .on("postgres_changes", { event: "*", schema: "public", table: "eventos" }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  // ── Eventos → formato FullCalendar ──
  const fcEventos = useMemo(() => eventos
    .filter((e) => filtros.length === 0 || filtros.includes(e.tipo))
    .map((e) => {
      const t = tipoDe(e.tipo);
      return {
        id: e.id, title: e.titulo,
        start: e.inicio, end: e.fin || undefined, allDay: !!e.todo_el_dia,
        extendedProps: { raw: e, color: t.color, bg: t.bg },
      };
    }), [eventos, filtros]);

  // ── Pedidos del vendedor → eventos de todo el día ──
  // Vienen ya filtrados por quien los abre (el panel sólo carga los del
  // vendedor logueado). No se pueden arrastrar ni abrir: la fecha de entrega
  // se cambia editando el pedido, no acá.
  const fcPedidos = useMemo(() => pedidos
    .filter((p) => filtros.length === 0 || filtros.includes(p.tipo))
    .map((p) => {
      const t = tipoDe(p.tipo);
      return {
        id: `pedido-${p.id}`,
        title: p.titulo,
        start: p.fecha,
        allDay: true,
        editable: false,
        extendedProps: { pedido: p, color: t.color, bg: t.bg },
      };
    }), [pedidos, filtros]);

  // ── Próximos eventos (panel lateral) ──
  const proximos = useMemo(() => {
    const ahora = Date.now();
    const dePedidos = pedidos.map((p) => ({
      id: `pedido-${p.id}`, titulo: p.titulo, inicio: `${p.fecha}T09:00:00`,
      tipo: p.tipo, todo_el_dia: true, lugar: p.estadoLabel, esPedido: true,
    }));
    return [...eventos, ...dePedidos]
      .filter((e) => new Date(e.fin || e.inicio).getTime() >= ahora)
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
      .slice(0, 6);
  }, [eventos, pedidos]);

  const api = () => calRef.current?.getApi();
  const sincTitulo = () => { const a = api(); if (a) setTitulo(a.view.title); };

  const irA = (accion) => { const a = api(); if (!a) return; a[accion](); sincTitulo(); };
  const cambiarVista = (k) => { setVista(k); const a = api(); if (a) { a.changeView(k); sincTitulo(); } };

  const toggleFiltro = (k) => setFiltros((f) => f.includes(k) ? f.filter((x) => x !== k) : [...f, k]);

  const onGuardado = (ev) => {
    setEventos((prev) => {
      const sin = prev.filter((e) => e.id !== ev.id);
      return [...sin, ev].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    });
    setModal(null);
  };
  const onEliminado = (id) => { setEventos((prev) => prev.filter((e) => e.id !== id)); setModal(null); };

  // Arrastrar / redimensionar un evento
  const moverEvento = async (info) => {
    const { event } = info;
    const upd = { inicio: event.start.toISOString(), fin: event.end ? event.end.toISOString() : null, todo_el_dia: event.allDay };
    const { data, error } = await supabase.from("eventos").update(upd).eq("id", event.id).select().single();
    if (error) { info.revert(); return; }
    setEventos((prev) => prev.map((e) => (e.id === data.id ? data : e)));
  };

  const btnIcon = {
    width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: R.sm, border: `1px solid ${L.border}`, background: L.white, color: L.muted, cursor: "pointer", transition: "all .15s",
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: L.bg, fontFamily: FONT_BODY }}>
      <style>{CAL_CSS}</style>

      {/* ── Barra de control ── */}
      <div style={{ padding: isMobile ? "12px 14px" : "16px 22px 12px", background: L.white, borderBottom: `1px solid ${L.border}`, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => irA("prev")} style={btnIcon} title="Anterior"><ChevronLeft size={17} /></button>
            <button onClick={() => irA("next")} style={btnIcon} title="Siguiente"><ChevronRight size={17} /></button>
            <button onClick={() => irA("today")}
              style={{ ...btnIcon, width: "auto", padding: "0 13px", fontSize: 12.5, fontWeight: 600, color: L.text }}>
              Hoy
            </button>
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: isMobile ? 17 : 21, fontWeight: 700, letterSpacing: "-.02em", color: L.text, textTransform: "capitalize", flex: 1, minWidth: 140 }}>
            {titulo || format(new Date(), "MMMM yyyy", { locale: es })}
          </div>

          {/* Selector de vista */}
          <div style={{ display: "flex", background: L.soft, borderRadius: R.sm, padding: 3, gap: 2 }}>
            {VISTAS.map((v) => (
              <button key={v.k} onClick={() => cambiarVista(v.k)}
                style={{
                  padding: "6px 13px", borderRadius: R.xs, border: "none", cursor: "pointer",
                  fontSize: 12.5, fontWeight: 600, transition: "all .15s",
                  background: vista === v.k ? L.white : "transparent",
                  color: vista === v.k ? L.text : L.muted,
                  boxShadow: vista === v.k ? SH.xs : "none",
                }}>
                {v.label}
              </button>
            ))}
          </div>

          <button onClick={() => setModal({ inicio: new Date().toISOString() })}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: R.sm, border: "none", background: C.red, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: SH.xs }}>
            <Plus size={16} /> {isMobile ? "" : "Nuevo evento"}
          </button>
        </div>

        {/* Filtros por tipo */}
        <div className="strip" style={{ display: "flex", gap: 7, overflowX: "auto" }}>
          {Object.keys(TIPOS_EVENTO).map((k) => (
            <ChipTipo key={k} tipo={k} activo={filtros.length === 0 || filtros.includes(k)} onClick={() => toggleFiltro(k)} size="sm" />
          ))}
          {filtros.length > 0 && (
            <button onClick={() => setFiltros([])}
              style={{ border: "none", background: "transparent", color: L.light, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "0 6px", whiteSpace: "nowrap" }}>
              Ver todos
            </button>
          )}
        </div>
      </div>

      {/* ── Calendario + próximos ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, padding: isMobile ? 12 : "16px 22px 20px", overflow: "hidden" }}>
        <div className="mn-cal" style={{ flex: 1, minWidth: 0, background: L.white, border: `1px solid ${L.border}`, borderRadius: R.lg, boxShadow: SH.sm, padding: 8, position: "relative" }}>
          {cargando && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.7)", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: R.lg }}>
              <Loader2 size={22} color={L.light} style={{ animation: "mnSpin .9s linear infinite" }} />
            </div>
          )}
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={vista}
            locale={esLocale}
            headerToolbar={false}
            height="100%"
            firstDay={1}
            nowIndicator
            dayMaxEvents={3}
            expandRows
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            editable
            selectable
            selectMirror
            events={[...fcEventos, ...fcPedidos]}
            datesSet={sincTitulo}
            select={(info) => setModal({ inicio: info.start.toISOString(), fin: info.end?.toISOString(), todo_el_dia: info.allDay })}
            eventClick={(info) => { const raw = info.event.extendedProps.raw; if (raw) setModal(raw); }}
            eventDrop={moverEvento}
            eventResize={moverEvento}
            eventContent={(arg) => {
              const { color, bg, raw, pedido } = arg.event.extendedProps;
              const conHora = !arg.event.allDay && arg.view.type === "dayGridMonth";
              return (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, overflow: "hidden",
                  padding: "3px 8px", borderRadius: 3, background: bg,
                  borderLeft: `2px solid ${color}`, fontSize: 11.5, lineHeight: 1.4, color: L.text,
                }}>
                  {conHora && <span style={{ color, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{arg.timeText}</span>}
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arg.event.title}</span>
                  {raw?.vendedor && <span style={{ marginLeft: "auto", fontSize: 10.5, color: L.light, flexShrink: 0 }}>{raw.vendedor}</span>}
                  {pedido && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color, flexShrink: 0, textTransform: "uppercase", letterSpacing: .3 }}>{pedido.estadoLabel}</span>}
                </div>
              );
            }}
          />
        </div>

        {/* Próximos eventos — solo desktop */}
        {!isMobile && (
          <aside style={{ width: 268, flexShrink: 0, background: L.white, border: `1px solid ${L.border}`, borderRadius: R.lg, boxShadow: SH.sm, padding: 16, overflowY: "auto" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: L.light, marginBottom: 14 }}>
              Próximos
            </div>
            {proximos.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "34px 0", color: L.light, textAlign: "center" }}>
                <CalIcon size={22} />
                <div style={{ fontSize: 13 }}>Sin eventos próximos</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {proximos.map((e) => {
                  const t = tipoDe(e.tipo);
                  const d = new Date(e.inicio);
                  return (
                    <button key={e.id} onClick={() => { if (!e.esPedido) setModal(e); }}
                      style={{ display: "flex", gap: 11, alignItems: "flex-start", textAlign: "left", padding: "10px 8px", borderRadius: R.sm, border: "none", background: "transparent", cursor: e.esPedido ? "default" : "pointer", transition: "background .12s" }}
                      onMouseEnter={(ev) => { ev.currentTarget.style.background = L.soft; }}
                      onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}>
                      <div style={{ width: 42, flexShrink: 0, textAlign: "center" }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: L.light }}>
                          {format(d, "MMM", { locale: es })}
                        </div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 700, color: L.text, lineHeight: 1.1 }}>
                          {format(d, "d")}
                        </div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.titulo}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 11.5, color: L.muted }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                          {e.todo_el_dia ? "Todo el día" : format(d, "HH:mm")}
                          {e.lugar && <span style={{ color: L.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {e.lugar}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {modal && (
        <ModalEvento evento={modal} userEmail={userEmail}
          onClose={() => setModal(null)} onGuardado={onGuardado} onEliminado={onEliminado} />
      )}
    </div>
  );
}
