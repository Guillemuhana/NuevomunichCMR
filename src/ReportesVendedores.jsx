import { useState, useMemo } from "react";
import {
  FileText, Users, Calendar, ChevronLeft, ChevronRight,
  Search, X, Printer, Download, User, MapPin, CheckSquare, Square,
} from "lucide-react";
import {
  C, L, R, FONT_DISPLAY, FONT_BODY,
  limpiarPrecios, cantidadItem, fechaLocalISO,
} from "./lib";
import { imprimirDoc, descargarDoc } from "./imprimir";
import { docFichaVisita, docReportesDia } from "./documentos";

// ============================================================
// REPORTES DE VENDEDORES
// ------------------------------------------------------------
// Lo que el vendedor carga desde la calle y NO es un pedido: los
// reportes de visita y las reuniones. Vivían mezclados en la lista
// de pedidos, donde nadie los leía y además ensuciaban el conteo.
// Acá tienen su propio calendario: se elige el día, se marcan los
// que interesan y se imprimen.
// ============================================================

// Un pedido es un pedido; todo lo demás (visita, reunión) es un reporte.
// El tipo puede venir vacío en filas viejas: esas son pedidos.
export function esReporte(det) {
  return (det?.tipo || "pedido") !== "pedido";
}

const TIPO_REPORTE = {
  visita:  { label: "Reporte", color: "#15803D", bg: "#DCFCE7", border: "#BBF7D0" },
  reunion: { label: "Reunión", color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
};
const tipoDe = (det) => TIPO_REPORTE[det?.tipo] || TIPO_REPORTE.visita;

function nombreDe(cont, det) {
  return cont?.nombre || cont?.telefono || det?.clienteNombre || det?.clienteTel || "Cliente sin nombre";
}

// El texto del reporte: lo único que de verdad se lee.
function textoDe(det) {
  return [det?.observacion, det?.notas, det?.detalle_extra]
    .map((t) => (t || "").trim()).filter(Boolean).join("\n\n");
}

function Chip({ children }) {
  return (
    <span style={{ fontSize: 11.5, color: L.muted, background: L.soft, border: `1px solid ${L.border}`, padding: "4px 10px", borderRadius: 6, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      {children}
    </span>
  );
}

function btn(tono, activo = true) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "9px 15px", borderRadius: 9, fontSize: 13, fontWeight: 700,
    fontFamily: FONT_BODY, cursor: activo ? "pointer" : "not-allowed",
    opacity: activo ? 1 : 0.45, whiteSpace: "nowrap",
    ...(tono === "primario"
      ? { background: "#15803D", color: "#fff", border: "none" }
      : { background: L.white, color: L.muted, border: `1px solid ${L.border}` }),
  };
}

// ── Calendario de reportes ──────────────────────────────────
// Mismo gesto que el de pedidos: el punto marca los días con carga y
// tocar un día lo elige, aunque ya estuviera elegido, para que el
// segundo clic no parezca que la pantalla se colgó.
function CalendarioReportes({ reportes, dia, onElegirDia }) {
  const [mes, setMes] = useState(dia ? new Date(dia + "T12:00") : new Date());
  const year = mes.getFullYear(), month = mes.getMonth();
  const primeroRaw = new Date(year, month, 1).getDay();
  const primero = primeroRaw === 0 ? 6 : primeroRaw - 1;
  const diasDelMes = new Date(year, month + 1, 0).getDate();

  const porDia = {};
  reportes.forEach((r) => {
    const f = fechaLocalISO(r.created_at);
    if (!f) return;
    const d = new Date(f + "T12:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      porDia[d.getDate()] = (porDia[d.getDate()] || 0) + 1;
    }
  });

  const celdas = [];
  for (let i = 0; i < primero; i++) celdas.push(null);
  for (let d = 1; d <= diasDelMes; d++) celdas.push(d);

  return (
    <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setMes(new Date(year, month - 1, 1))} title="Mes anterior"
          style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: L.text, textTransform: "capitalize" }}>
          {mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setMes(new Date(year, month + 1, 1))} title="Mes siguiente"
          style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: L.light, padding: "2px 0" }}>{d}</div>
        ))}
        {celdas.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const n = porDia[d] || 0;
          const elegido = dia === iso;
          const esHoy = new Date().toDateString() === new Date(iso + "T12:00").toDateString();
          return (
            <button key={d} onClick={() => onElegirDia(iso)}
              title={n ? `${n} ${n === 1 ? "reporte" : "reportes"}` : undefined}
              style={{ position: "relative", textAlign: "center", padding: "5px 0", borderRadius: 7, border: "none", cursor: "pointer", background: elegido ? "#15803D" : esHoy ? "#F0FDF4" : "transparent", color: elegido ? "#fff" : esHoy ? "#15803D" : L.text, fontWeight: n ? 700 : 400, fontSize: 13, fontFamily: FONT_BODY }}>
              {d}
              {n > 0 && !elegido && (
                <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: "#15803D" }} />
              )}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: L.light, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#15803D", flexShrink: 0 }} />
        Días con reportes cargados
      </div>
    </div>
  );
}

// ── Ficha completa de un reporte ────────────────────────────
function ModalReporte({ entrada, contacto, parse, onCerrar }) {
  const det = parse(entrada.detalle);
  const t = tipoDe(det);
  const texto = textoDe(det);
  const items = (det.items || []).filter((i) => i.desc?.trim());
  const archivo = `reporte-${(entrada.id || "").slice(0, 6)}.pdf`;
  const doc = () => docFichaVisita(entrada, contacto, parse);

  return (
    <>
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", backdropFilter: "blur(3px)", zIndex: 430 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(94vw,600px)", maxHeight: "88vh", background: L.white, borderRadius: 16, boxShadow: "0 30px 90px rgba(0,0,0,.35)", zIndex: 431, display: "flex", flexDirection: "column", fontFamily: FONT_BODY, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${L.border}`, borderTop: `3px solid ${t.color}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileText size={19} color={t.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: L.text }}>{nombreDe(contacto, det)}</div>
            <div style={{ fontSize: 12.5, color: L.muted, marginTop: 1 }}>
              {t.label} · {entrada.vendedor || "sin vendedor"} · {new Date(entrada.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <button onClick={onCerrar} title="Cerrar"
            style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            {contacto?.telefono && <Chip>{contacto.telefono}</Chip>}
            {(det.direccion || contacto?.direccion) && <Chip><MapPin size={11} /> {det.direccion || contacto.direccion}</Chip>}
            {det.entrega && <Chip>{det.entrega}</Chip>}
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: L.text, whiteSpace: "pre-wrap" }}>
            {texto ? limpiarPrecios(texto) : <span style={{ fontStyle: "italic", color: L.light }}>Este reporte no tiene observaciones escritas.</span>}
          </div>
          {items.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${L.border}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: L.light, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Productos conversados</div>
              <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.6 }}>
                {items.map((i, idx) => (
                  <span key={idx}>{idx > 0 ? " · " : ""}<strong style={{ color: L.text }}>{cantidadItem(i)}</strong> {limpiarPrecios(i.desc)}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${L.border}`, padding: "13px 22px", display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => imprimirDoc(doc(), archivo)} style={btn("primario")}>
            <Printer size={15} /> Imprimir
          </button>
          <button onClick={() => descargarDoc(doc(), archivo)} style={btn()}>
            <Download size={15} /> Descargar PDF
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// PANEL
// ============================================================
/**
 * @param {object[]} reportes  filas de `pedidos` que NO son pedidos
 * @param {Record<string,object>} contactos  mapa id -> contacto
 * @param {(raw:any)=>object} parse  parser del campo detalle
 * @param {boolean} loading
 */
export default function PanelReportes({ reportes = [], contactos = {}, parse, loading = false }) {
  const [dia, setDia] = useState(null);          // día elegido en el calendario
  const [busqueda, setBusqueda] = useState("");
  const [vendedor, setVendedor] = useState("todos");
  const [abierto, setAbierto] = useState(null);  // ficha en pantalla
  const [elegidos, setElegidos] = useState([]);  // ids tildados para imprimir

  const vendedores = useMemo(
    () => [...new Set(reportes.map((r) => r.vendedor).filter(Boolean))].sort(),
    [reportes]
  );

  const lista = useMemo(() => reportes.filter((r) => {
    const det = parse(r.detalle);
    const cont = contactos[r.contacto_id] || {};
    if (dia && !fechaLocalISO(r.created_at).startsWith(dia)) return false;
    if (vendedor !== "todos" && r.vendedor !== vendedor) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const heno = `${nombreDe(cont, det)} ${r.vendedor || ""} ${textoDe(det)}`.toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  }), [reportes, contactos, parse, dia, vendedor, busqueda]);

  // Sólo se imprime lo que además está a la vista: si se cambia el filtro,
  // una tilde que quedó escondida no se cuela en el PDF.
  const visibles = useMemo(() => new Set(lista.map((r) => r.id)), [lista]);
  const seleccion = elegidos.filter((id) => visibles.has(id));
  const todosTildados = lista.length > 0 && seleccion.length === lista.length;

  const alternar = (id) =>
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const alternarTodos = () =>
    setElegidos(todosTildados ? [] : lista.map((r) => r.id));

  // Con reportes tildados manda la selección; si no, todo lo que se ve.
  const aImprimir = seleccion.length ? lista.filter((r) => seleccion.includes(r.id)) : lista;
  // El PDF sale como "Reportes del día" sólo cuando de verdad es la jornada
  // entera sin recortar; si hay tildes o filtros, va como selección.
  const esDiaEntero = !!dia && !seleccion.length && vendedor === "todos" && !busqueda;
  const doc = () => docReportesDia(aImprimir, contactos, parse, esDiaEntero ? dia : null);
  const archivo = `reportes-${dia || fechaLocalISO(new Date())}.pdf`;

  const fechaLarga = dia
    ? new Date(dia + "T12:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  const porVendedorDelDia = useMemo(() => lista.reduce((acc, r) => {
    const v = r.vendedor || "Sin asignar";
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {}), [lista]);

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

      {/* ── Lista ── */}
      <div style={{ flex: 1, minWidth: 300 }}>

        {/* Filtros */}
        <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={13} color={L.light} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente, vendedor o texto del reporte…"
              style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 29px", borderRadius: 9, border: `1px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
          </div>

          <select value={vendedor} onChange={(e) => setVendedor(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${vendedor !== "todos" ? "#15803D" : L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: vendedor !== "todos" ? "#15803D" : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
            <option value="todos">Todos los vendedores</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          {dia && (
            <button onClick={() => setDia(null)} title="Ver todos los días"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY }}>
              <Calendar size={12} />
              {new Date(dia + "T12:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
              <X size={11} />
            </button>
          )}

          {(busqueda || vendedor !== "todos" || dia || elegidos.length > 0) && (
            <button onClick={() => { setBusqueda(""); setVendedor("todos"); setDia(null); setElegidos([]); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: L.soft, color: L.muted, border: `1px solid ${L.border}`, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY }}>
              <X size={12} /> Limpiar
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 12.5, color: L.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
            {lista.length} {lista.length === 1 ? "reporte" : "reportes"}
          </span>
        </div>

        {/* Barra de impresión: dice con todas las letras qué va a salir */}
        <div style={{ background: seleccion.length ? "#F0FDF4" : L.white, border: `1px solid ${seleccion.length ? "#BBF7D0" : L.border}`, borderRadius: R.md, padding: "9px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={alternarTodos} disabled={!lista.length}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: lista.length ? "pointer" : "not-allowed", color: L.muted, fontSize: 12.5, fontWeight: 700, fontFamily: FONT_BODY, padding: 0, opacity: lista.length ? 1 : 0.5 }}>
            {todosTildados ? <CheckSquare size={16} color="#15803D" /> : <Square size={16} />}
            {todosTildados ? "Quitar todos" : "Elegir todos"}
          </button>

          <span style={{ fontSize: 12.5, color: L.muted, flex: 1, minWidth: 140 }}>
            {seleccion.length
              ? <><strong style={{ color: "#15803D" }}>{seleccion.length}</strong> elegido{seleccion.length > 1 ? "s" : ""} para imprimir</>
              : fechaLarga
                ? <span style={{ textTransform: "capitalize" }}>{fechaLarga}</span>
                : "Se imprime todo lo que estás viendo"}
          </span>

          <div className="barra-acciones">
            <button onClick={() => aImprimir.length && imprimirDoc(doc(), archivo)}
              style={btn("primario", aImprimir.length > 0)} className="btn-compacto">
              <Printer size={15} />
              <span className="solo-desktop">Imprimir{seleccion.length ? " elegidos" : dia ? " el día" : ""}</span>
            </button>
            <button onClick={() => aImprimir.length && descargarDoc(doc(), archivo)}
              style={btn("", aImprimir.length > 0)} className="btn-compacto">
              <Download size={15} /> <span className="solo-desktop">PDF</span>
            </button>
          </div>
        </div>

        {/* Reportes */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: L.muted, fontSize: 14 }}>Cargando reportes…</div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: L.white, borderRadius: 14, border: `1px solid ${L.border}` }}>
            <FileText size={44} color={L.border} style={{ display: "block", margin: "0 auto 12px" }} />
            <div style={{ color: L.muted, fontSize: 15, fontWeight: 600 }}>
              {dia ? "No hay reportes cargados en este día" : "Sin reportes"}
            </div>
          </div>
        ) : lista.map((r) => {
          const det = parse(r.detalle);
          const cont = contactos[r.contacto_id] || {};
          const t = tipoDe(det);
          const texto = textoDe(det);
          const tildado = seleccion.includes(r.id);
          const archivoUno = `reporte-${(r.id || "").slice(0, 6)}.pdf`;
          return (
            <div key={r.id}
              style={{ background: L.white, border: `1px solid ${tildado ? t.border : L.border}`, borderLeft: `3px solid ${t.color}`, borderRadius: R.md, marginBottom: 8, padding: "14px 16px", boxShadow: tildado ? `0 0 0 2px ${t.bg}` : "none", transition: "border-color .15s ease, box-shadow .15s ease" }}>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <button onClick={() => alternar(r.id)}
                  title={tildado ? "Quitar de la impresión" : "Elegir para imprimir"}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: tildado ? t.color : L.light, flexShrink: 0, marginTop: 2 }}>
                  {tildado ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 7 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: L.text }}>
                      {nombreDe(cont, det)}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 6, background: t.bg, color: t.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.red, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      <User size={11} />{r.vendedor || "sin vendedor"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: L.light, whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Un adelanto del texto; para leerlo entero está "Ver reporte" */}
                  <div style={{ fontSize: 13, color: L.muted, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>
                    {texto ? limpiarPrecios(texto) : <span style={{ fontStyle: "italic", color: L.light }}>Sin observaciones</span>}
                  </div>

                  <div className="barra-acciones" style={{ marginTop: 10 }}>
                    <button onClick={() => setAbierto(r)}
                      style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: L.muted, fontFamily: FONT_BODY, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <FileText size={12} /> Ver reporte
                    </button>
                    <button onClick={() => imprimirDoc(docFichaVisita(r, cont, parse), archivoUno)} title="Imprimir este reporte"
                      style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: L.muted, fontFamily: FONT_BODY, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <Printer size={12} /> <span className="solo-desktop">Imprimir</span>
                    </button>
                    <button onClick={() => descargarDoc(docFichaVisita(r, cont, parse), archivoUno)} title="Descargar este reporte"
                      style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: L.muted, fontFamily: FONT_BODY, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                      <Download size={12} /> <span className="solo-desktop">PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Calendario ── */}
      <div style={{ width: 288, flexShrink: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <Calendar size={14} color="#15803D" /> Calendario de reportes
        </div>
        <CalendarioReportes reportes={reportes} dia={dia}
          onElegirDia={(d) => { setDia(d); setElegidos([]); }} />

        {/* Quién trajo qué en el día elegido */}
        {dia && (
          <div style={{ marginTop: 12, background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: L.muted, textTransform: "capitalize" }}>{fechaLarga}</span>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 9px" }}>
                {lista.length}
              </span>
            </div>
            {lista.length === 0 ? (
              <div style={{ fontSize: 12.5, color: L.light }}>Sin reportes este día</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(porVendedorDelDia).map(([v, n]) => (
                  <div key={v} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: L.muted }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={12} /> {v}</span>
                    <strong style={{ color: L.text }}>{n}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {abierto && (
        <ModalReporte entrada={abierto} contacto={contactos[abierto.contacto_id] || {}}
          parse={parse} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}
