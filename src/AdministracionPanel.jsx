import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Package, Search, X, Calendar,
  ChevronLeft, ChevronRight, LogOut, Bell,
  Trash2, AlertCircle, User,
  Phone, Download, MapPin, FileDown, FileText, Printer, Truck, Paperclip,
} from "lucide-react";
import {
  supabase, C, L, R, SH, FONT_DISPLAY, FONT_BODY,
  limpiarPrecios, LOGO_URL, exportarCSV, cantidadItem,
  fechaLocalISO, hoyLocalISO,
} from "./lib";
import { parseDet, imprimirPedido, EP } from "./Pedidos";
import { imprimirDoc, descargarDoc } from "./imprimir";
import { docHojaRuta, docVentasRango } from "./documentos";
import PanelReportes, { esReporte } from "./ReportesVendedores";


function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function isHoy(iso) {
  if (!iso) return false;
  return new Date(iso + "T12:00").toDateString() === new Date().toDateString();
}
function isManiana(iso) {
  if (!iso) return false;
  const m = new Date(); m.setDate(m.getDate() + 1);
  return new Date(iso + "T12:00").toDateString() === m.toDateString();
}
function isVencido(iso) {
  if (!iso) return false;
  return new Date(iso + "T23:59:59") < new Date() && !isHoy(iso);
}
// El día al que pertenece un pedido en el calendario: el día en que se cargó.
// Antes mandaba la fecha de entrega, así que un pedido tomado ayer con entrega
// para el viernes recién aparecía el viernes y "los pedidos de ayer" se veían
// vacíos. Para lo que hay que repartir tal día están los avisos de entrega de
// arriba, el filtro por fecha de entrega y la hoja de ruta.
function fechaPedido(p) {
  return fechaLocalISO(p.created_at);
}

const VENDOR_COLORS = ["#B91C1C","#1D4ED8","#15803D","#7C3AED","#B45309","#0E7490"];

// Los datos del pie de la tarjeta (teléfono, entrega, dirección, pago) son
// todos del mismo rango: se ven iguales para que la vista los barra de un
// saque y no compitan con el nombre del cliente ni con los botones.
const chipPie = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 11.5, fontWeight: 600, color: L.muted,
  background: L.soft, border: `1px solid ${L.border}`,
  borderRadius: 6, padding: "4px 9px", whiteSpace: "nowrap",
};

// Imprimir / PDF / Eliminar: mismo alto que el selector de estado y el
// botón de fecha, para que la barra de acciones quede a una sola línea.
const btnAccion = {
  display: "flex", alignItems: "center", gap: 5,
  height: 34, boxSizing: "border-box", padding: "0 11px",
  background: L.soft, border: `1px solid ${L.border}`, borderRadius: 8,
  fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, color: L.muted,
  cursor: "pointer", whiteSpace: "nowrap",
};

// El vendedor puede cargar un pedido escribiendo sólo el nombre del cliente,
// sin teléfono. En ese caso no se crea ningún contacto y el nombre queda
// guardado dentro del detalle: si no lo miramos ahí, todos esos pedidos se
// ven como "Cliente sin nombre".
function nombreCliente(cont, det) {
  return cont?.nombre || cont?.telefono || det?.clienteNombre || det?.clienteTel || "Cliente sin nombre";
}

function VendedorBadge({ alias }) {
  const idx = (alias || "").charCodeAt(0) % VENDOR_COLORS.length;
  return (
    <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 7, background: VENDOR_COLORS[idx] + "20", color: VENDOR_COLORS[idx], fontWeight: 700, letterSpacing: 0.3 }}>
      {alias || "Sin vendedor"}
    </span>
  );
}

// Tocar un día SIEMPRE lo abre, aunque ya estuviera elegido: antes el segundo
// clic lo deseleccionaba y no pasaba nada, que parecía que la ventana no
// funcionaba. Para quitar el filtro está la X del chip de la fecha.
function MiniCalendar({ pedidos, onSelectDate, selectedDate }) {
  const [mes, setMes] = useState(new Date());
  const year = mes.getFullYear(), month = mes.getMonth();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const ordersByDate = {};
  pedidos.forEach(p => {
    const fp = fechaPedido(p);
    if (!fp) return;
    const d = new Date(fp + "T12:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      ordersByDate[d.getDate()] = (ordersByDate[d.getDate()] || 0) + 1;
    }
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setMes(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}><ChevronLeft size={16} /></button>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: L.text, textTransform: "capitalize" }}>
          {mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setMes(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
        {["L","M","M","J","V","S","D"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: L.light, padding: "2px 0" }}>{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = ordersByDate[d] || 0;
          const isSelected = selectedDate === iso;
          const isToday = new Date().toDateString() === new Date(iso + "T12:00").toDateString();
          return (
            <button key={d} onClick={() => onSelectDate(iso)}
              style={{ position: "relative", textAlign: "center", padding: "5px 0", borderRadius: 7, border: "none", cursor: count || isToday ? "pointer" : "default", background: isSelected ? C.red : isToday ? "#FEF2F2" : "transparent", color: isSelected ? "#fff" : isToday ? C.red : L.text, fontWeight: count ? 700 : 400, fontSize: 13 }}>
              {d}
              {count > 0 && !isSelected && (
                <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: C.red }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================
// EL DÍA, EN GRANDE
// ============================================================
// Al tocar un día del calendario se abre esto: todo lo de esa jornada
// junto, con los números arriba y la hoja de ruta a un clic. Es la
// pantalla que administración mira a la mañana para armar el reparto.
function ModalDia({ dia, pedidos, contactos, onCerrar, onVerEnLista }) {
  const delDia = pedidos.filter((p) => fechaPedido(p).startsWith(dia));
  // Lo que hay que repartir ese día es otra cosa que lo que se cargó ese día,
  // y la hoja de ruta va por lo primero. Se cuenta aparte para que el botón no
  // quede apagado cuando hay entregas agendadas pero no se cargó nada.
  const entregasDia = pedidos.filter(
    (p) => parseDet(p.detalle).fecha_entrega === dia && p.estado !== "cancelado"
  );

  const porEstado = {};
  const porVendedor = {};
  let entregas = 0;
  for (const p of delDia) {
    const e = EP[p.estado]?.label || p.estado;
    porEstado[e] = (porEstado[e] || 0) + 1;
    const v = p.vendedor || "Sin asignar";
    porVendedor[v] = (porVendedor[v] || 0) + 1;
    if (parseDet(p.detalle).entrega === "Delivery") entregas++;
  }

  const fechaLarga = new Date(dia + "T12:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const doc = () => docHojaRuta(pedidos, contactos, parseDet, new Date(dia + "T12:00"));
  const archivo = `hoja-de-ruta-${dia}.pdf`;

  const exportar = () => {
    exportarCSV(delDia.map((p) => {
      const cont = contactos[p.contacto_id] || {};
      const det = parseDet(p.detalle);
      return {
        Cliente: nombreCliente(cont, det),
        "Teléfono": cont.telefono || det.clienteTel || "",
        Vendedor: p.vendedor || "",
        Estado: EP[p.estado]?.label || p.estado,
        Entrega: det.entrega || "",
        "Dirección": det.direccion || cont.direccion || "",
        Pago: det.pago || "",
        Productos: (det.items || []).filter((i) => i.desc).map((i) => `${cantidadItem(i)} ${limpiarPrecios(i.desc)}`).join(", "),
        "Observación": det.notas || det.observacion || "",
      };
    }), `pedidos-${dia}.csv`);
  };

  const btnDia = (tono, activo = delDia.length > 0) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "9px 15px", borderRadius: 9, fontSize: 13, fontWeight: 700,
    fontFamily: FONT_BODY, cursor: activo ? "pointer" : "not-allowed",
    opacity: activo ? 1 : .45, whiteSpace: "nowrap",
    ...(tono === "primario"
      ? { background: C.red, color: "#fff", border: "none" }
      : { background: L.white, color: L.muted, border: `1px solid ${L.border}` }),
  });

  return (
    <>
      <div onClick={onCerrar}
        style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", backdropFilter: "blur(3px)", zIndex: 420 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(96vw, 780px)", maxHeight: "90vh", background: L.bg, borderRadius: 18, boxShadow: "0 30px 90px rgba(0,0,0,.35)", zIndex: 421, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_BODY }}>

        {/* Cabecera */}
        <div style={{ background: L.white, borderBottom: `1px solid ${L.border}`, borderTop: `3px solid ${C.red}`, padding: "16px 22px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1 }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: C.red, textTransform: "uppercase", letterSpacing: .5 }}>
              {new Date(dia + "T12:00").toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 800, color: C.red }}>
              {new Date(dia + "T12:00").getDate()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: L.text, textTransform: "capitalize", lineHeight: 1.2 }}>
              {fechaLarga}
            </div>
            <div style={{ fontSize: 12.5, color: L.muted, marginTop: 3 }}>
              {delDia.length === 0 && entregasDia.length === 0
                ? "Este día no tuvo movimiento"
                : [
                    delDia.length ? `${delDia.length} ${delDia.length === 1 ? "pedido cargado" : "pedidos cargados"}` : null,
                    entregasDia.length ? `${entregasDia.length} ${entregasDia.length === 1 ? "entrega agendada" : "entregas agendadas"}` : null,
                    entregas ? `${entregas} con delivery` : null,
                  ].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button onClick={onCerrar} title="Cerrar"
            style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: L.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Resumen del día */}
        {delDia.length > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "12px 22px 0", flexWrap: "wrap", flexShrink: 0 }}>
            {Object.entries(porEstado).map(([e, n]) => (
              <span key={e} style={{ fontSize: 11.5, fontWeight: 700, color: L.muted, background: L.white, border: `1px solid ${L.border}`, borderRadius: 999, padding: "5px 12px" }}>
                {e}: <strong style={{ color: L.text }}>{n}</strong>
              </span>
            ))}
            {Object.entries(porVendedor).map(([v, n]) => (
              <span key={v} style={{ fontSize: 11.5, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "5px 12px" }}>
                {v}: {n}
              </span>
            ))}
          </div>
        )}

        {/* Los pedidos del día */}
        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
          {delDia.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: L.light }}>
              <Package size={30} color={L.border} />
              <div style={{ fontSize: 14, marginTop: 12 }}>Este día no tiene pedidos cargados.</div>
            </div>
          ) : delDia.map((p) => {
            const cont = contactos[p.contacto_id] || {};
            const det = parseDet(p.detalle);
            const ep = EP[p.estado] || EP.pendiente;
            const items = (det.items || []).filter((i) => i.desc?.trim());
            return (
              <div key={p.id} style={{ background: L.white, border: `1px solid ${L.border}`, borderLeft: `3px solid ${ep.color}`, borderRadius: 10, padding: "12px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14.5, color: L.text }}>
                    {nombreCliente(cont, det)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: ep.bg, color: ep.color, textTransform: "uppercase" }}>
                    {ep.label}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: L.light }}>{p.vendedor || "sin vendedor"}</span>
                </div>

                <div style={{ fontSize: 12.5, color: L.muted, lineHeight: 1.5 }}>
                  {items.length
                    ? items.map((i, idx) => <span key={idx}>{idx > 0 ? " · " : ""}<strong style={{ color: L.text }}>{cantidadItem(i)}</strong> {limpiarPrecios(i.desc)}</span>)
                    : <span style={{ fontStyle: "italic" }}>{limpiarPrecios(det.observacion || det.notas) || "Sin detalle"}</span>}
                </div>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: L.muted, alignItems: "center" }}>
                  <span style={{ background: L.soft, borderRadius: 6, padding: "3px 9px", fontWeight: 600 }}>{det.entrega || "—"}</span>
                  <span style={{ background: L.soft, borderRadius: 6, padding: "3px 9px", fontWeight: 600 }}>{det.pago || "—"}</span>
                  {det.direccion && (
                    <span style={{ background: L.soft, borderRadius: 6, padding: "3px 9px", display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={10} /> {det.direccion.slice(0, 40)}
                    </span>
                  )}
                  <button onClick={() => imprimirPedido(p, cont, { imprimir: true })}
                    style={{ marginLeft: "auto", background: L.white, border: `1px solid ${L.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: L.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY }}>
                    <Printer size={11} /> Imprimir
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones del día */}
        <div style={{ background: L.white, borderTop: `1px solid ${L.border}`, padding: "13px 22px", display: "flex", gap: 9, flexWrap: "wrap", flexShrink: 0 }}>
          <button onClick={() => entregasDia.length && imprimirDoc(doc(), archivo)} style={btnDia("primario", entregasDia.length > 0)}>
            <Printer size={15} /> Imprimir hoja de ruta
          </button>
          <button onClick={() => entregasDia.length && descargarDoc(doc(), archivo)} style={btnDia("", entregasDia.length > 0)}>
            <Download size={15} /> Descargar PDF
          </button>
          <button onClick={() => delDia.length && exportar()} style={btnDia()}>
            <FileDown size={15} /> Exportar CSV
          </button>
          <button onClick={onVerEnLista} style={{ ...btnDia(), marginLeft: "auto", opacity: 1, cursor: "pointer" }}>
            Ver en la lista
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdministracionPanel({ userName, userEmail, rol, onLogout }) {
  // El reporte de ventas muestra facturación y ranking de vendedores: eso lo
  // mira sólo Cristian. El personal de administración gestiona pedidos; no
  // necesita ver los números del negocio.
  const esCristian = rol === "admin";
  const [pedidos, setPedidos] = useState([]);
  // Reporte de ventas por rango de fechas (modal)
  const [showVentas, setShowVentas] = useState(false);
  const hoyISO = hoyLocalISO();
  const primeroDeMes = `${hoyISO.slice(0, 7)}-01`;
  const [vDesde, setVDesde] = useState(primeroDeMes);
  const [vHasta, setVHasta] = useState(hoyISO);
  const [contactos, setContactos] = useState({});
  const [vendedoresList, setVendedoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaCampo, setFechaCampo] = useState("creado"); // "entrega" | "creado"
  const [selectedDate, setSelectedDate] = useState(null);
  const [editandoFecha, setEditandoFecha] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(true);
  const [reporteAbierto, setReporteAbierto] = useState(null); // { titulo, texto }
  const [diaAbierto, setDiaAbierto] = useState(null);        // día del calendario en pantalla grande
  // Pedidos y reportes vivían en la misma lista: los reportes de visita no
  // tienen productos ni estado que gestionar, así que ensuciaban la pantalla
  // y falseaban el conteo. Cada cosa en su pestaña.
  const [tab, setTab] = useState("pedidos");   // "pedidos" | "reportes"

  const cargar = useCallback(async () => {
    setLoading(true);
    const [pedsRes, vendsRes] = await Promise.all([
      supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
      supabase.from("vendedores").select("nombre").eq("activo", true).order("nombre"),
    ]);

    const peds = pedsRes.data || [];
    if (peds.length > 0) {
      const ids = [...new Set(peds.map(p => p.contacto_id).filter(Boolean))];
      const { data: conts } = await supabase.from("contactos").select("id,nombre,telefono,empresa,direccion").in("id", ids);
      const map = {};
      (conts || []).forEach(c => { map[c.id] = c; });
      setContactos(map);
    }
    setPedidos(peds);
    setVendedoresList(vendsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // La tabla `pedidos` guarda las tres cosas que carga el vendedor: pedidos,
  // reportes de visita y reuniones. Acá se parten en dos y de ahí en más
  // TODO lo de esta pantalla (lista, calendario, alertas, ventas, hoja de
  // ruta, CSV) mira sólo los pedidos.
  const soloPedidos = useMemo(
    () => pedidos.filter((p) => !esReporte(parseDet(p.detalle))),
    [pedidos]
  );
  const soloReportes = useMemo(
    () => pedidos.filter((p) => esReporte(parseDet(p.detalle))),
    [pedidos]
  );

  useEffect(() => {
    const alerts = [];
    soloPedidos.forEach(p => {
      const det = parseDet(p.detalle);
      if (!det.fecha_entrega) return;
      const cont = contactos[p.contacto_id] || {};
      const nombre = `${p.vendedor || "?"}: ${cont.nombre || cont.telefono || "Cliente"}`;
      if (p.estado === "entregado" || p.estado === "cancelado") return;
      if (isHoy(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "hoy", texto: `Entrega HOY — ${nombre}` });
      else if (isManiana(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "maniana", texto: `Entrega mañana — ${nombre}` });
      else if (isVencido(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "vencido", texto: `Vencida — ${nombre} (${fmtDate(det.fecha_entrega)})` });
    });
    setNotifs(alerts);
  }, [soloPedidos, contactos]);

  const updateFechaEntrega = async (pedidoId, detalleStr, newDate) => {
    const det = parseDet(detalleStr);
    det.fecha_entrega = newDate || null;
    await supabase.from("pedidos").update({ detalle: JSON.stringify(det) }).eq("id", pedidoId);
    await cargar();
    setEditandoFecha(null);
  };

  const updateEstado = async (pedidoId, newEstado) => {
    await supabase.from("pedidos").update({ estado: newEstado }).eq("id", pedidoId);
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: newEstado } : p));
  };

  const eliminarPedido = async (pedidoId) => {
    if (!window.confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    await supabase.from("pedidos").delete().eq("id", pedidoId);
    setPedidos(prev => prev.filter(p => p.id !== pedidoId));
  };

  const lista = soloPedidos.filter(p => {
    const cont = contactos[p.contacto_id] || {};
    const nombre = (cont.nombre || cont.telefono || "").toLowerCase();
    const det = parseDet(p.detalle);
    const items = (det.items || []).map(i => i.desc || "").join(" ").toLowerCase();
    const porBusq = !busqueda || nombre.includes(busqueda.toLowerCase()) || items.includes(busqueda.toLowerCase()) || (p.vendedor || "").toLowerCase().includes(busqueda.toLowerCase());
    const porVend = filtroVendedor === "todos" || p.vendedor === filtroVendedor;
    const porEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    // Fecha: el calendario selecciona un día puntual (por carga). Si no hay día
    // seleccionado, aplica el rango Desde/Hasta sobre el campo elegido (entrega/creado).
    const fe = det.fecha_entrega;
    const fechaRef = fechaCampo === "creado" ? fechaLocalISO(p.created_at) : fe;
    let porFecha = true;
    if (selectedDate) {
      porFecha = fechaPedido(p).startsWith(selectedDate);
    } else {
      if (fechaDesde) porFecha = porFecha && !!fechaRef && fechaRef >= fechaDesde;
      if (fechaHasta) porFecha = porFecha && !!fechaRef && fechaRef <= fechaHasta;
    }
    // Al tocar un día en el calendario se quiere ver TODO lo de ese día, sin
    // importar el estado: si quedaba un filtro puesto de antes, el día se veía
    // a medias y parecía que faltaban pedidos.
    if (selectedDate) return porBusq && porVend && porFecha;

    return porBusq && porVend && porEstado && porFecha;
  });

  const handleExportCSV = () => {
    const rows = lista.map(p => {
      const cont = contactos[p.contacto_id] || {};
      const det = parseDet(p.detalle);
      return {
        Vendedor: p.vendedor || "",
        Cliente: cont.nombre || cont.telefono || "",
        Telefono: cont.telefono || "",
        Empresa: cont.empresa || "",
        Productos: (det.items || []).filter(i => i.desc).map(i => `${cantidadItem(i)} ${limpiarPrecios(i.desc)}`).join(", "),
        Estado: (EP[p.estado] || {}).label || p.estado,
        Entrega: det.entrega || "",
        Direccion: det.direccion || "",
        Pago: det.pago || "",
        FechaEntrega: det.fecha_entrega || "",
        Notas: det.notas || "",
        Creado: new Date(p.created_at).toLocaleDateString("es-AR"),
      };
    });
    exportarCSV(rows, `pedidos_${hoyLocalISO()}.csv`);
  };

  // Ventas del período elegido en el modal.
  const docVentas = () => docVentasRango(soloPedidos, contactos, parseDet, vDesde, vHasta, EP);
  const nombreVentas = () => `ventas-${vDesde}-al-${vHasta}.pdf`;
  const ventasEnRango = soloPedidos.filter((p) => {
    const fch = new Date(p.created_at);
    return fch >= new Date(`${vDesde}T00:00:00`) && fch <= new Date(`${vHasta}T23:59:59`);
  }).length;

  // Hoja de ruta: las entregas agendadas para hoy, para quien reparte.
  const hojaRuta = () => docHojaRuta(soloPedidos, contactos, parseDet, new Date());
  const nombreHojaRuta = () => `hoja-de-ruta-${hoyLocalISO()}.pdf`;

  const alertColor = {
    hoy: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "#D97706" },
    maniana: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "#1D4ED8" },
    vencido: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: C.red },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: L.bg, fontFamily: FONT_BODY }}>

      {/* Header */}
      <div style={{ background: L.white, borderBottom: `1px solid ${L.border}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, boxShadow: SH.sm, flexWrap: "wrap", rowGap: 8 }}>
        <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 42, objectFit: "contain" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: L.text, textTransform: "uppercase", letterSpacing: 0.4 }}>Panel de Administración</div>
          <div style={{ fontSize: 12, color: L.muted }}>{userName || userEmail} · Gestión de pedidos</div>
        </div>
        <div className="barra-acciones">
          {notifs.length > 0 && (
            <button onClick={() => setShowNotifs(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "7px 14px", cursor: "pointer" }}>
              <Bell size={15} color={C.red} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{notifs.length} alerta{notifs.length > 1 ? "s" : ""}</span>
            </button>
          )}
          {esCristian && (
            <button onClick={() => setShowVentas(true)} title="Reporte de ventas por rango de fechas" className="btn-compacto"
              style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D", borderRadius: 9, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY }}>
              <FileText size={15} /> <span className="solo-desktop">Ventas</span>
            </button>
          )}
          <button onClick={() => imprimirDoc(hojaRuta(), nombreHojaRuta())} title="Imprimir la hoja de ruta de entregas de hoy" className="btn-compacto"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 9, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY }}>
            <Truck size={15} /> <span className="solo-desktop">Hoja de ruta</span>
          </button>
          <button onClick={() => descargarDoc(hojaRuta(), nombreHojaRuta())} title="Descargar la hoja de ruta en PDF"
            style={{ background: L.soft, border: `1px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Download size={15} />
          </button>
          {/* El CSV es de la lista de pedidos: en la pestaña Reportes no
              tiene sentido, y exportaba pedidos sin avisar. */}
          {tab === "pedidos" && (
          <button onClick={handleExportCSV} title="Exportar CSV"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1D4ED8", borderRadius: 9, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY }}>
            <FileDown size={15} /> <span className="solo-desktop">Exportar</span>
          </button>
          )}
          {onLogout && (
            <button onClick={onLogout} title="Cerrar sesión"
              style={{ background: L.soft, border: `1px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Con la lista de la izquierda fuera, esta pantalla puede quedar de
          1900px: una tarjeta de ese ancho no se lee. El padding lateral
          crece solo y centra el contenido en 1600px. */}
      <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "22px max(24px, calc((100% - 1600px) / 2))" }}>

        {/* Alertas */}
        {/* Las alertas se acomodan en columnas: una barra de 1600px por cada
            "Entrega HOY — Boris: Fulano" empujaba la lista fuera de pantalla
            cuando había varias. */}
        {showNotifs && notifs.length > 0 && (
          <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
            {notifs.map((n, i) => {
              const col = alertColor[n.tipo];
              return (
                <div key={`${n.id}-${i}`} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={16} color={col.icon} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: col.text, flex: 1 }}>{n.texto}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pestañas: Pedidos y Reportes son dos trabajos distintos */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { k: "pedidos",  label: "Pedidos",  icon: <Package size={14} />,  count: soloPedidos.length,  color: C.red },
            { k: "reportes", label: "Reportes", icon: <FileText size={14} />, count: soloReportes.length, color: "#15803D" },
          ].map(({ k, label, icon, count, color }) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => { setTab(k); setDiaAbierto(null); }}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: `1px solid ${on ? color : L.border}`, background: on ? color : L.white, color: on ? "#fff" : L.muted, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: 0.3, textTransform: "uppercase", transition: "all .15s" }}>
                {icon} {label}
                <span style={{ background: on ? "rgba(255,255,255,.25)" : L.soft, color: on ? "#fff" : L.muted, borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {tab === "reportes" ? (
          <PanelReportes reportes={soloReportes} contactos={contactos}
            parse={parseDet} loading={loading} />
        ) : (
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Lista de pedidos */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Filtros */}
            <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <Search size={13} color={L.light} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar vendedor, cliente, producto…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 29px", borderRadius: 9, border: `1px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
              <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${filtroVendedor !== "todos" ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: filtroVendedor !== "todos" ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                <option value="todos">Todos los vendedores</option>
                {vendedoresList.map(v => <option key={v.nombre} value={v.nombre}>{v.nombre}</option>)}
              </select>
              {/* Con un día elegido el estado no se aplica: se ve apagado para que
                  se entienda que está en pausa, no que dejó de funcionar. */}
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${filtroEstado !== "todos" && !selectedDate ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: filtroEstado !== "todos" && !selectedDate ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600, opacity: selectedDate ? 0.5 : 1 }}>
                <option value="todos">Todos los estados</option>
                {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Calendar size={12} />
                  {new Date(selectedDate + "T12:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                  {filtroEstado !== "todos" && <span style={{ fontWeight: 600, opacity: .8 }}>· todos los estados</span>}
                  <X size={11} />
                </button>
              )}

              {/* Rango de fechas */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", opacity: selectedDate ? 0.4 : 1, pointerEvents: selectedDate ? "none" : "auto" }}>
                <select value={fechaCampo} onChange={e => setFechaCampo(e.target.value)} title="Campo de fecha"
                  style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: L.white, color: L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                  <option value="entrega">Entrega</option>
                  <option value="creado">Carga</option>
                </select>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde"
                  style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${fechaDesde ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: fechaDesde ? "#FEF2F2" : L.white, color: L.text, outline: "none" }} />
                <span style={{ fontSize: 12, color: L.light }}>→</span>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta"
                  style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${fechaHasta ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: fechaHasta ? "#FEF2F2" : L.white, color: L.text, outline: "none" }} />
              </div>

              {(busqueda || filtroVendedor !== "todos" || filtroEstado !== "todos" || fechaDesde || fechaHasta || selectedDate) && (
                <button onClick={() => { setBusqueda(""); setFiltroVendedor("todos"); setFiltroEstado("todos"); setFechaDesde(""); setFechaHasta(""); setSelectedDate(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: L.soft, color: L.muted, border: `1px solid ${L.border}`, borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <X size={12} /> Limpiar
                </button>
              )}

              <span style={{ marginLeft: "auto", fontSize: 12.5, color: L.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
                {lista.length} {lista.length === 1 ? "pedido" : "pedidos"}
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: L.muted, fontSize: 14 }}>Cargando pedidos…</div>
            ) : lista.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, background: L.white, borderRadius: 14, border: `1px solid ${L.border}` }}>
                <Package size={44} color={L.border} style={{ display: "block", margin: "0 auto 12px" }} />
                <div style={{ color: L.muted, fontSize: 15, fontWeight: 600 }}>Sin pedidos encontrados</div>
              </div>
            ) : lista.map(ped => {
              const cont = contactos[ped.contacto_id] || {};
              const det = parseDet(ped.detalle);
              const ep = EP[ped.estado] || EP.pendiente;
              const editF = editandoFecha === ped.id;
              const fe = det.fecha_entrega;
              const alertaFecha = fe && (isHoy(fe) || isVencido(fe));
              const borderColor = alertaFecha ? (isVencido(fe) ? "#FECACA" : "#FDE68A") : L.border;
              const items = det.items.filter(i => i.desc?.trim());
              const obs = (det.notas || det.observacion || "").trim();

              return (
                <div key={ped.id}
                  // Antes la tarjeta crecía al pasar el mouse (scale 1.018): con la
                  // lista llena, el cursor la agrandaba, corría la de al lado y costaba
                  // apuntarle a los botones. Ahora sólo se marca el borde.
                  style={{ background: L.white, border: `1px solid ${borderColor}`, borderLeft: `3px solid ${ep.color}`, borderRadius: R.md, marginBottom: 9, padding: "14px 18px", transition: "border-color .15s ease, box-shadow .15s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = SH.md; e.currentTarget.style.borderColor = L.light; e.currentTarget.style.borderLeftColor = ep.color; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.borderLeftColor = ep.color; }}>

                  {/* ── Renglón 1: de quién es el pedido ──
                      Cliente, estado y vendedor en una sola línea. Antes el
                      vendedor y el estado vivían en dos bloques distintos y
                      había que barrer la tarjeta con la vista para saber
                      de quién era y cómo venía. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: items.length || obs ? 9 : 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "#FEF2F2", flexShrink: 0 }}>
                      <User size={15} color={C.red} />
                    </span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: L.text, letterSpacing: 0.2 }}>
                      {nombreCliente(cont, det)}
                    </span>
                    {cont.empresa && <span style={{ fontSize: 12, color: L.muted }}>· {cont.empresa}</span>}
                    <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 5, background: ep.bg, color: ep.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, border: `1px solid ${ep.color}33` }}>{ep.label}</span>
                    <VendedorBadge alias={ped.vendedor} />
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: L.light, whiteSpace: "nowrap" }}>
                      {new Date(ped.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* ── Renglón 2: qué pidió ── */}
                  {items.length > 0 && (
                    <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.55, marginBottom: obs || det.detalle_extra?.trim() ? 9 : 0 }}>
                      {items.slice(0, 6).map((it, idx) => (
                        <span key={idx}>{idx > 0 ? " · " : ""}
                          <strong style={{ color: L.text }}>{cantidadItem(it)}</strong> {limpiarPrecios(it.desc)}
                        </span>
                      ))}
                      {items.length > 6 && <span style={{ color: L.light }}> +{items.length - 6} más</span>}
                    </div>
                  )}

                  {/* La observación a la vista. Antes vivía detrás del botón
                      "Ver reporte", que se sacó de este panel: quedaba escrita
                      por el vendedor y administración no la leía nunca. Es
                      justo lo que hace falta para preparar el pedido. */}
                  {obs && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 11px", marginBottom: det.detalle_extra?.trim() ? 9 : 0 }}>
                      <FileText size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: "#7C2D12", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {limpiarPrecios(obs)}
                      </span>
                    </div>
                  )}

                  {det.detalle_extra?.trim() && (
                    <div style={{ fontSize: 12, color: L.muted, paddingLeft: 2, lineHeight: 1.5 }}>
                      <strong style={{ color: L.text }}>Detalle adicional:</strong> {limpiarPrecios(det.detalle_extra)}
                    </div>
                  )}

                  {/* ── Pie: los datos del reparto a la izquierda y todo lo
                      que se toca a la derecha, en una sola barra. Antes esto
                      era una columna apretada contra el borde derecho que en
                      pantallas angostas se desarmaba. ── */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 11, marginTop: 11, borderTop: `1px solid ${L.soft}` }}>

                    {cont.telefono && (
                      <span style={chipPie}><Phone size={11} /> {cont.telefono}</span>
                    )}
                    <span style={chipPie}><Package size={11} /> {det.entrega}</span>
                    {det.entrega === "Delivery" && det.direccion && (
                      <span style={chipPie} title={det.direccion}>
                        <MapPin size={11} /> {det.direccion.length > 34 ? det.direccion.slice(0, 34) + "…" : det.direccion}
                      </span>
                    )}
                    <span style={chipPie}>{det.pago}</span>
                    {det.adjunto_url && (
                      <a href={det.adjunto_url} target="_blank" rel="noreferrer"
                        title={det.adjunto_nombre || "Adjunto del vendedor"}
                        style={{ ...chipPie, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", textDecoration: "none", maxWidth: 190 }}>
                        <Paperclip size={11} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {det.adjunto_nombre || "Ver adjunto"}
                        </span>
                      </a>
                    )}

                    {/* Lo que se toca, siempre pegado a la derecha */}
                    <div className="barra-acciones" style={{ marginLeft: "auto" }}>

                      {/* Fecha de entrega */}
                      {editF ? (
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <input type="date" defaultValue={fe || ""}
                            onBlur={e => updateFechaEntrega(ped.id, ped.detalle, e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateFechaEntrega(ped.id, ped.detalle, e.target.value)}
                            autoFocus
                            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 13, fontFamily: FONT_BODY, outline: "none", background: "#FEF2F2" }} />
                          <button onClick={() => setEditandoFecha(null)} title="Cancelar"
                            style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex" }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditandoFecha(ped.id)}
                          title={fe ? "Cambiar la fecha de entrega" : "Poner fecha de entrega"}
                          style={{ display: "flex", alignItems: "center", gap: 6, height: 34, boxSizing: "border-box", background: fe ? (alertaFecha ? (isVencido(fe) ? "#FEF2F2" : "#FFFBEB") : L.soft) : L.soft, border: `1px solid ${fe && alertaFecha ? (isVencido(fe) ? "#FECACA" : "#FDE68A") : L.border}`, borderRadius: 8, padding: "0 11px", cursor: "pointer", fontSize: 12.5, fontFamily: FONT_BODY, fontWeight: fe ? 700 : 500, color: fe ? (isHoy(fe) ? "#D97706" : isVencido(fe) ? C.red : L.muted) : L.light }}>
                          <Calendar size={12} />
                          {fe ? fmtDate(fe) : "Fecha entrega"}
                          {isHoy(fe) && <span style={{ fontSize: 9.5, background: "#FDE68A", color: "#92400E", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>HOY</span>}
                          {isVencido(fe) && <span style={{ fontSize: 9.5, background: "#FECACA", color: C.red, borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>VENCIDA</span>}
                        </button>
                      )}

                      {/* Estado: es lo que más se toca en esta pantalla, así
                          que va con el color del estado y bien a mano. */}
                      <select value={ped.estado} onChange={e => updateEstado(ped.id, e.target.value)}
                        title="Cambiar el estado del pedido"
                        style={{ height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${ep.color}`, background: ep.bg, color: ep.color, fontSize: 12.5, fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", cursor: "pointer", outline: "none" }}>
                        {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>

                      {/* Separador: los tres de la derecha son acciones sobre
                          el papel, no sobre el pedido. */}
                      <span className="solo-desktop" style={{ width: 1, height: 22, background: L.border, margin: "0 2px" }} />

                      <button onClick={() => imprimirPedido(ped, cont, { imprimir: true })} title="Imprimir el pedido"
                        style={btnAccion}
                        onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = L.muted; e.currentTarget.style.borderColor = L.border; }}>
                        <Printer size={13} /> <span className="solo-desktop">Imprimir</span>
                      </button>
                      <button onClick={() => imprimirPedido(ped, cont)} title="Descargar el PDF"
                        style={btnAccion}
                        onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = L.muted; e.currentTarget.style.borderColor = L.border; }}>
                        <Download size={13} /> <span className="solo-desktop">PDF</span>
                      </button>
                      <button onClick={() => eliminarPedido(ped.id)} title="Eliminar el pedido"
                        style={{ ...btnAccion, color: "#EF4444" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#EF4444"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#EF4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = L.border; }}>
                        <Trash2 size={13} /> <span className="solo-desktop">Eliminar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendario — queda a la vista mientras se baja por la lista */}
          <div style={{ width: 288, flexShrink: 0, position: "sticky", top: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} color={C.red} /> Calendario de pedidos
            </div>
            <MiniCalendar pedidos={soloPedidos} selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); if (d) setDiaAbierto(d); }} />

            {selectedDate && (() => {
              const pedidosDia = soloPedidos.filter(p => fechaPedido(p).startsWith(selectedDate));
              return (
              <div style={{ marginTop: 12, background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: L.muted, textTransform: "capitalize" }}>
                    {new Date(selectedDate + "T12:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: C.red, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "2px 9px" }}>
                    {pedidosDia.length} {pedidosDia.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </div>
                {pedidosDia.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: L.light, padding: "6px 0" }}>Sin pedidos este día</div>
                ) : pedidosDia.map(p => {
                  const cont = contactos[p.contacto_id] || {};
                  const ep = EP[p.estado] || EP.pendiente;
                  return (
                    <div key={p.id} style={{ padding: "8px 0", borderTop: `1px solid ${L.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <VendedorBadge alias={p.vendedor} />
                        <span style={{ fontWeight: 700, color: L.text, fontSize: 12, flex: 1 }}>{nombreCliente(cont, parseDet(p.detalle))}</span>
                        <span style={{ padding: "1px 7px", borderRadius: 6, background: ep.bg, color: ep.color, fontSize: 10.5, fontWeight: 700 }}>{ep.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: L.muted, marginTop: 3 }}>{parseDet(p.detalle).entrega}</div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
        )}
      </div>

      {diaAbierto && (
        <ModalDia dia={diaAbierto} pedidos={soloPedidos} contactos={contactos}
          onCerrar={() => setDiaAbierto(null)}
          onVerEnLista={() => setDiaAbierto(null)} />
      )}

      {/* Modal: reporte de ventas por rango de fechas */}
      {showVentas && esCristian && (
        <>
          <div onClick={() => setShowVentas(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(94vw,440px)", background: L.white, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.3)", zIndex: 401, fontFamily: FONT_BODY, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={19} color="#15803D" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: L.text }}>Reporte de ventas</div>
                <div style={{ fontSize: 12.5, color: L.muted, marginTop: 1 }}>Elegí el período a informar</div>
              </div>
              <button onClick={() => setShowVentas(false)} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 22px" }}>
              {/* Atajos de período */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {[
                  { k: "hoy",    label: "Hoy",            d: hoyISO },
                  { k: "semana", label: "Últimos 7 días", d: fechaLocalISO(new Date(Date.now() - 6 * 864e5)) },
                  { k: "mes",    label: "Este mes",       d: primeroDeMes },
                  { k: "anio",   label: "Este año",       d: `${hoyISO.slice(0, 4)}-01-01` },
                ].map((r) => {
                  const activo = vDesde === r.d && vHasta === hoyISO;
                  return (
                    <button key={r.k} onClick={() => { setVDesde(r.d); setVHasta(hoyISO); }}
                      style={{ background: activo ? C.red : L.soft, color: activo ? "#fff" : L.muted, border: `1px solid ${activo ? C.red : L.border}`, borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY }}>
                      {r.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ flex: 1, minWidth: 130, fontSize: 11.5, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Desde
                  <input type="date" value={vDesde} max={vHasta} onChange={(e) => setVDesde(e.target.value)}
                    style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: 8, border: `1px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, color: L.text, outline: "none" }} />
                </label>
                <label style={{ flex: 1, minWidth: 130, fontSize: 11.5, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Hasta
                  <input type="date" value={vHasta} min={vDesde} max={hoyISO} onChange={(e) => setVHasta(e.target.value)}
                    style={{ display: "block", width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: 8, border: `1px solid ${L.border}`, fontSize: 13.5, fontFamily: FONT_BODY, color: L.text, outline: "none" }} />
                </label>
              </div>

              <div style={{ marginTop: 14, padding: "10px 13px", background: L.soft, borderRadius: 9, fontSize: 13, color: L.muted }}>
                {ventasEnRango === 0
                  ? "No hay ventas en el período elegido."
                  : `${ventasEnRango} ${ventasEnRango === 1 ? "venta" : "ventas"} en el período.`}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                <button onClick={() => imprimirDoc(docVentas(), nombreVentas())} disabled={ventasEnRango === 0}
                  style={{ flex: 1, minWidth: 130, background: ventasEnRango === 0 ? L.soft : C.red, color: ventasEnRango === 0 ? L.light : "#fff", border: "none", borderRadius: 9, padding: "11px 16px", cursor: ventasEnRango === 0 ? "not-allowed" : "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Printer size={16} /> Imprimir
                </button>
                <button onClick={() => descargarDoc(docVentas(), nombreVentas())} disabled={ventasEnRango === 0}
                  style={{ flex: 1, minWidth: 130, background: L.soft, color: ventasEnRango === 0 ? L.light : L.text, border: `1px solid ${L.border}`, borderRadius: 9, padding: "11px 16px", cursor: ventasEnRango === 0 ? "not-allowed" : "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Download size={16} /> Descargar PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal: ver reporte completo */}
      {reporteAbierto && esCristian && (
        <>
          <div onClick={() => setReporteAbierto(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(94vw,560px)", maxHeight: "85vh", background: L.white, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.3)", zIndex: 401, display: "flex", flexDirection: "column", fontFamily: FONT_BODY, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={19} color="#B45309" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 17, color: L.text }}>Reporte</div>
                <div style={{ fontSize: 12.5, color: L.muted, marginTop: 1 }}>
                  {reporteAbierto.titulo}{reporteAbierto.vendedor ? ` · ${reporteAbierto.vendedor}` : ""}
                </div>
              </div>
              <button onClick={() => setReporteAbierto(null)} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", fontSize: 14.5, lineHeight: 1.6, color: L.text, whiteSpace: "pre-wrap" }}>
              {reporteAbierto.texto}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
