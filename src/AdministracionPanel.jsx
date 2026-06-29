import { useState, useEffect, useCallback } from "react";
import {
  Package, Search, X, Calendar,
  ChevronLeft, ChevronRight, LogOut, Bell,
  Trash2, AlertCircle, User,
  Phone, Download, MapPin, FileDown, FileText,
} from "lucide-react";
import {
  supabase, C, FONT_DISPLAY, FONT_BODY,
  limpiarPrecios, LOGO_URL, exportarCSV,
} from "./lib";
import { parseDet, imprimirPedido, EP } from "./Pedidos";

const L = {
  bg: "#F5F6F8", white: "#FFFFFF", border: "#E4E8ED",
  text: "#0F172A", muted: "#64748B", light: "#94A3B8",
  soft: "#F1F5F9",
};

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
// Fecha "efectiva" del pedido para el calendario: usa la fecha de entrega si
// está cargada; si no, cae en la fecha de creación (YYYY-MM-DD).
function fechaPedido(p) {
  const fe = parseDet(p.detalle).fecha_entrega;
  return fe || (p.created_at || "").slice(0, 10);
}

const VENDOR_COLORS = ["#B91C1C","#1D4ED8","#15803D","#7C3AED","#B45309","#0E7490"];

function VendedorBadge({ alias }) {
  const idx = (alias || "").charCodeAt(0) % VENDOR_COLORS.length;
  return (
    <span style={{ fontSize: 10.5, padding: "2px 9px", borderRadius: 7, background: VENDOR_COLORS[idx] + "20", color: VENDOR_COLORS[idx], fontWeight: 700, letterSpacing: 0.3 }}>
      {alias || "Sin vendedor"}
    </span>
  );
}

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
            <button key={d} onClick={() => onSelectDate(isSelected ? null : iso)}
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

export default function AdministracionPanel({ userName, userEmail, onLogout }) {
  const [pedidos, setPedidos] = useState([]);
  const [contactos, setContactos] = useState({});
  const [vendedoresList, setVendedoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [fechaCampo, setFechaCampo] = useState("entrega"); // "entrega" | "creado"
  const [selectedDate, setSelectedDate] = useState(null);
  const [editandoFecha, setEditandoFecha] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(true);
  const [reporteAbierto, setReporteAbierto] = useState(null); // { titulo, texto }

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

  useEffect(() => {
    const alerts = [];
    pedidos.forEach(p => {
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
  }, [pedidos, contactos]);

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

  const lista = pedidos.filter(p => {
    const cont = contactos[p.contacto_id] || {};
    const nombre = (cont.nombre || cont.telefono || "").toLowerCase();
    const det = parseDet(p.detalle);
    const items = (det.items || []).map(i => i.desc || "").join(" ").toLowerCase();
    const porBusq = !busqueda || nombre.includes(busqueda.toLowerCase()) || items.includes(busqueda.toLowerCase()) || (p.vendedor || "").toLowerCase().includes(busqueda.toLowerCase());
    const porVend = filtroVendedor === "todos" || p.vendedor === filtroVendedor;
    const porEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    // Fecha: el calendario selecciona un día puntual (por entrega). Si no hay día
    // seleccionado, aplica el rango Desde/Hasta sobre el campo elegido (entrega/creado).
    const fe = det.fecha_entrega;
    const fechaRef = fechaCampo === "creado" ? (p.created_at || "").slice(0, 10) : fe;
    let porFecha = true;
    if (selectedDate) {
      porFecha = fechaPedido(p).startsWith(selectedDate);
    } else {
      if (fechaDesde) porFecha = porFecha && !!fechaRef && fechaRef >= fechaDesde;
      if (fechaHasta) porFecha = porFecha && !!fechaRef && fechaRef <= fechaHasta;
    }
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
        Productos: (det.items || []).filter(i => i.desc).map(i => `${i.qty}x ${limpiarPrecios(i.desc)}`).join(", "),
        Estado: (EP[p.estado] || {}).label || p.estado,
        Entrega: det.entrega || "",
        Direccion: det.direccion || "",
        Pago: det.pago || "",
        FechaEntrega: det.fecha_entrega || "",
        Notas: det.notas || "",
        Creado: new Date(p.created_at).toLocaleDateString("es-AR"),
      };
    });
    exportarCSV(rows, `pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const alertColor = {
    hoy: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "#D97706" },
    maniana: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "#1D4ED8" },
    vencido: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: C.red },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: L.bg, fontFamily: FONT_BODY }}>

      {/* Header */}
      <div style={{ background: L.white, borderBottom: `3px solid ${C.gold}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 52, objectFit: "contain" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: L.text, textTransform: "uppercase", letterSpacing: 0.4 }}>Panel de Administración</div>
          <div style={{ fontSize: 12, color: L.muted }}>{userName || userEmail} · Gestión de pedidos</div>
        </div>
        {notifs.length > 0 && (
          <button onClick={() => setShowNotifs(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "7px 14px", cursor: "pointer" }}>
            <Bell size={15} color={C.red} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{notifs.length} alerta{notifs.length > 1 ? "s" : ""}</span>
          </button>
        )}
        <button onClick={handleExportCSV} title="Exportar CSV"
          style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", color: "#1D4ED8", borderRadius: 9, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, fontFamily: FONT_BODY }}>
          <FileDown size={15} /> Exportar
        </button>
        {onLogout && (
          <button onClick={onLogout} title="Cerrar sesión"
            style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>

        {/* Alertas */}
        {showNotifs && notifs.length > 0 && (
          <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 7 }}>
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

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Lista de pedidos */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Filtros */}
            <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <Search size={13} color={L.light} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar vendedor, cliente, producto…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 29px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
              <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${filtroVendedor !== "todos" ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: filtroVendedor !== "todos" ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                <option value="todos">Todos los vendedores</option>
                {vendedoresList.map(v => <option key={v.nombre} value={v.nombre}>{v.nombre}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${filtroEstado !== "todos" ? C.red : L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.white, color: filtroEstado !== "todos" ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                <option value="todos">Todos los estados</option>
                {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Calendar size={12} />
                  {new Date(selectedDate + "T12:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                  <X size={11} />
                </button>
              )}

              {/* Rango de fechas */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", opacity: selectedDate ? 0.4 : 1, pointerEvents: selectedDate ? "none" : "auto" }}>
                <select value={fechaCampo} onChange={e => setFechaCampo(e.target.value)} title="Campo de fecha"
                  style={{ padding: "8px 10px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: L.white, color: L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                  <option value="entrega">Entrega</option>
                  <option value="creado">Creado</option>
                </select>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} title="Desde"
                  style={{ padding: "7px 10px", borderRadius: 9, border: `1.5px solid ${fechaDesde ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: fechaDesde ? "#FEF2F2" : L.white, color: L.text, outline: "none" }} />
                <span style={{ fontSize: 12, color: L.light }}>→</span>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} title="Hasta"
                  style={{ padding: "7px 10px", borderRadius: 9, border: `1.5px solid ${fechaHasta ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: fechaHasta ? "#FEF2F2" : L.white, color: L.text, outline: "none" }} />
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

              return (
                <div key={ped.id}
                  style={{ background: L.white, border: `1px solid ${borderColor}`, borderLeft: `4px solid ${ep.color}`, borderRadius: 10, marginBottom: 12, padding: "18px 20px", boxShadow: "0 1px 3px rgba(15,23,42,.05)", transition: "box-shadow .18s ease, transform .18s ease", willChange: "transform" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 14px 32px rgba(15,23,42,.14)"; e.currentTarget.style.transform = "scale(1.018)"; e.currentTarget.style.zIndex = "5"; e.currentTarget.style.position = "relative"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,23,42,.05)"; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = "auto"; }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>

                    {/* Izquierda */}
                    <div style={{ flex: 1, minWidth: 220 }}>
                      {/* Cliente + Estado */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: "#FEF2F2", flexShrink: 0 }}>
                          <User size={16} color={C.red} />
                        </span>
                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, color: L.text, letterSpacing: 0.2 }}>
                          {cont.nombre || cont.telefono || "Cliente sin nombre"}
                        </span>
                        {cont.empresa && <span style={{ fontSize: 12, color: L.muted }}>· {cont.empresa}</span>}
                        <span style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 5, background: ep.bg, color: ep.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, border: `1px solid ${ep.color}33` }}>{ep.label}</span>
                      </div>

                      {/* Vendedor */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                        <span style={{ fontSize: 10.5, color: L.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Vendedor</span>
                        <VendedorBadge alias={ped.vendedor} />
                      </div>

                      <div style={{ fontSize: 13.5, color: L.muted, marginBottom: 10, lineHeight: 1.55 }}>
                        {det.items.filter(i => i.desc?.trim()).slice(0, 4).map((it, idx) => (
                          <span key={idx}>{idx > 0 ? " · " : ""}
                            <strong style={{ color: L.text }}>{it.qty}×</strong> {limpiarPrecios(it.desc)}
                          </span>
                        ))}
                        {det.items.filter(i => i.desc?.trim()).length > 4 && (
                          <span style={{ color: L.light }}> +{det.items.filter(i => i.desc?.trim()).length - 4} más</span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${L.soft}` }}>
                        {cont.telefono && (
                          <span style={{ fontSize: 11.5, color: L.muted, display: "flex", alignItems: "center", gap: 4, background: L.soft, padding: "4px 9px", borderRadius: 6, fontWeight: 600 }}>
                            <Phone size={11} /> {cont.telefono}
                          </span>
                        )}
                        <span style={{ fontSize: 11.5, color: L.muted, display: "flex", alignItems: "center", gap: 4, background: L.soft, padding: "4px 9px", borderRadius: 6, fontWeight: 600 }}>
                          <Package size={11} /> {det.entrega}
                        </span>
                        {det.entrega === "Delivery" && det.direccion && (
                          <span style={{ fontSize: 11.5, color: L.muted, display: "flex", alignItems: "center", gap: 4, background: L.soft, padding: "4px 9px", borderRadius: 6, fontWeight: 600 }}>
                            <MapPin size={11} /> {det.direccion.slice(0, 35)}
                          </span>
                        )}
                        <span style={{ fontSize: 11.5, color: L.muted, background: L.soft, padding: "4px 9px", borderRadius: 6, fontWeight: 600 }}>{det.pago}</span>
                        {det.notas?.trim() && (
                          <button onClick={() => setReporteAbierto({ titulo: cont.nombre || cont.telefono || "Cliente sin nombre", vendedor: ped.vendedor, texto: det.notas })}
                            style={{ fontSize: 11.5, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 11px", borderRadius: 6, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY, transition: "all .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#FEF3C7"; e.currentTarget.style.borderColor = "#FCD34D"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#FFFBEB"; e.currentTarget.style.borderColor = "#FDE68A"; }}>
                            <FileText size={12} /> Ver reporte
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Derecha */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: L.light }}>
                        {new Date(ped.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>

                      {/* Fecha entrega */}
                      {editF ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="date" defaultValue={fe || ""}
                            onBlur={e => updateFechaEntrega(ped.id, ped.detalle, e.target.value)}
                            onKeyDown={e => e.key === "Enter" && updateFechaEntrega(ped.id, ped.detalle, e.target.value)}
                            autoFocus
                            style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.red}`, fontSize: 13, fontFamily: FONT_BODY, outline: "none", background: "#FEF2F2" }} />
                          <button onClick={() => setEditandoFecha(null)} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditandoFecha(ped.id)}
                          style={{ display: "flex", alignItems: "center", gap: 6, background: fe ? (alertaFecha ? (isVencido(fe) ? "#FEF2F2" : "#FFFBEB") : L.soft) : L.soft, border: `1px solid ${fe ? (alertaFecha ? (isVencido(fe) ? "#FECACA" : "#FDE68A") : L.border) : L.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: fe ? 700 : 400, color: fe ? (isHoy(fe) ? "#D97706" : isVencido(fe) ? C.red : L.muted) : L.light }}>
                          <Calendar size={12} />
                          {fe ? fmtDate(fe) : "Fecha entrega"}
                          {isHoy(fe) && <span style={{ fontSize: 9.5, background: "#FDE68A", color: "#92400E", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>HOY</span>}
                          {isVencido(fe) && <span style={{ fontSize: 9.5, background: "#FECACA", color: C.red, borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>VENCIDA</span>}
                        </button>
                      )}

                      {/* Estado */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 9.5, color: L.light, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Estado del pedido</span>
                        <select value={ped.estado} onChange={e => updateEstado(ped.id, e.target.value)}
                          style={{ padding: "9px 14px", borderRadius: 6, border: `1px solid ${ep.color}`, borderBottom: `3px solid ${ep.color}`, fontSize: 14, fontFamily: FONT_DISPLAY, background: "#fff", color: ep.color, cursor: "pointer", outline: "none", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", boxShadow: "0 2px 5px rgba(15,23,42,.10)", transition: "transform .12s ease, box-shadow .12s ease, border-bottom-width .12s ease" }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 5px 12px rgba(15,23,42,.16)"; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 5px rgba(15,23,42,.10)"; e.currentTarget.style.borderBottomWidth = "3px"; }}
                          onMouseDown={e => { e.currentTarget.style.transform = "translateY(1px)"; e.currentTarget.style.borderBottomWidth = "1px"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,.12)"; }}
                          onMouseUp={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderBottomWidth = "3px"; }}>
                          {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>

                      {/* PDF + Eliminar */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => imprimirPedido(ped, cont)} title="Descargar PDF"
                          style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: L.muted, fontFamily: FONT_BODY, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.red; }}
                          onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = L.muted; e.currentTarget.style.borderColor = L.border; }}>
                          <Download size={12} /> PDF
                        </button>
                        <button onClick={() => eliminarPedido(ped.id)} title="Eliminar pedido"
                          style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: "#EF4444", fontFamily: FONT_BODY, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#EF4444"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#EF4444"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = L.border; }}>
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendario */}
          <div style={{ width: 270, flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} color={C.red} /> Calendario de entregas
            </div>
            <MiniCalendar pedidos={pedidos} onSelectDate={setSelectedDate} selectedDate={selectedDate} />

            {selectedDate && (() => {
              const pedidosDia = pedidos.filter(p => fechaPedido(p).startsWith(selectedDate));
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
                        <span style={{ fontWeight: 700, color: L.text, fontSize: 12, flex: 1 }}>{cont.nombre || cont.telefono || "Cliente sin nombre"}</span>
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
      </div>

      {/* Modal: ver reporte completo */}
      {reporteAbierto && (
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
