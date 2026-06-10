import { useState, useEffect, useCallback } from "react";
import {
  Package, Search, Clock, Check, X, Calendar,
  ChevronLeft, ChevronRight, LogOut, Bell,
  TrendingUp, ShoppingBag, CheckCircle, AlertCircle,
  Phone, Download, MapPin,
} from "lucide-react";
import {
  supabase, C, FONT_DISPLAY, FONT_BODY, VENDEDORES_INFO,
  fmtMoneda, LOGO_URL,
} from "./lib";
import { parseDet, imprimirPedido, EP } from "./Pedidos";

const L = {
  bg: "#F5F6F8", white: "#FFFFFF", border: "#E4E8ED",
  text: "#0F172A", muted: "#64748B", light: "#94A3B8",
  soft: "#F1F5F9", hover: "#FEF2F2",
};

function getVendorInfo(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  return VENDEDORES_INFO.find(v => v.emailPrefix === prefix) || { nombre: prefix, alias: prefix, emailPrefix: prefix };
}

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
  const d = new Date(iso + "T23:59:59");
  return d < new Date() && !isHoy(iso);
}

// ── Mini Calendario ──────────────────────────────────────────
function MiniCalendar({ pedidos, onSelectDate, selectedDate }) {
  const [mes, setMes] = useState(new Date());
  const year = mes.getFullYear();
  const month = mes.getMonth();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const ordersByDate = {};
  pedidos.forEach(p => {
    const fe = parseDet(p.detalle).fecha_entrega;
    if (!fe) return;
    const d = new Date(fe + "T12:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!ordersByDate[day]) ordersByDate[day] = [];
      ordersByDate[day].push(p);
    }
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const mesNombre = mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => setMes(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: L.text, textTransform: "capitalize" }}>{mesNombre}</span>
        <button onClick={() => setMes(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, display: "flex", padding: 4 }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: L.muted, padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const hasOrders = ordersByDate[day];
          const today = new Date();
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const sel = selectedDate === dateStr;
          return (
            <button key={day} onClick={() => onSelectDate(sel ? null : dateStr)}
              style={{ width: "100%", aspectRatio: "1", border: "none", borderRadius: 6, cursor: "pointer", background: sel ? C.red : isToday ? "#FEF2F2" : "transparent", color: sel ? "#fff" : isToday ? C.red : L.text, fontSize: 12, fontWeight: hasOrders ? 800 : 400, position: "relative", transition: "all .1s" }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = L.soft; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = isToday ? "#FEF2F2" : "transparent"; }}>
              {day}
              {hasOrders && (
                <span style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: sel ? "#fff" : C.red, display: "block" }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel Principal del Vendedor ─────────────────────────────
export default function VendedorDashboard({ userEmail, onLogout, vendorAliasOverride }) {
  const vendorInfo = vendorAliasOverride
    ? (VENDEDORES_INFO.find(v => v.alias === vendorAliasOverride) || { nombre: vendorAliasOverride, alias: vendorAliasOverride })
    : getVendorInfo(userEmail);
  const [pedidos, setPedidos] = useState([]);
  const [contactos, setContactos] = useState({});
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [selectedDate, setSelectedDate] = useState(null);
  const [editandoFecha, setEditandoFecha] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: peds } = await supabase
      .from("pedidos")
      .select("*")
      .eq("vendedor", vendorInfo.alias)
      .order("created_at", { ascending: false });

    if (peds && peds.length > 0) {
      const ids = [...new Set(peds.map(p => p.contacto_id).filter(Boolean))];
      const { data: conts } = await supabase.from("contactos").select("id,nombre,telefono,empresa,direccion").in("id", ids);
      const contMap = {};
      (conts || []).forEach(c => { contMap[c.id] = c; });
      setContactos(contMap);
    }
    setPedidos(peds || []);
    setLoading(false);
  }, [vendorInfo.alias]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const alerts = [];
    pedidos.forEach(p => {
      const det = parseDet(p.detalle);
      if (!det.fecha_entrega) return;
      const cont = contactos[p.contacto_id] || {};
      const nombre = cont.nombre || cont.telefono || "Cliente";
      if (p.estado === "entregado" || p.estado === "cancelado") return;
      if (isHoy(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "hoy", texto: `Entrega HOY: ${nombre}` });
      else if (isManiana(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "maniana", texto: `Entrega mañana: ${nombre}` });
      else if (isVencido(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "vencido", texto: `Vencida: ${nombre} (${fmtDate(det.fecha_entrega)})` });
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

  let lista = pedidos.filter(p => {
    const cont = contactos[p.contacto_id] || {};
    const nombre = (cont.nombre || cont.telefono || "").toLowerCase();
    const det = parseDet(p.detalle);
    const itemsText = (det.items || []).map(i => i.desc || "").join(" ").toLowerCase();
    const porBusq = !busqueda || nombre.includes(busqueda.toLowerCase()) || itemsText.includes(busqueda.toLowerCase());
    const porEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    const porFecha = !selectedDate || (det.fecha_entrega && det.fecha_entrega.startsWith(selectedDate));
    return porBusq && porEstado && porFecha;
  });

  const stats = {
    total: pedidos.length,
    enProceso: pedidos.filter(p => ["pendiente", "confirmado", "preparando", "listo"].includes(p.estado)).length,
    monto: pedidos.reduce((s, p) => s + (p.total || 0), 0),
    entregados: pedidos.filter(p => p.estado === "entregado").length,
  };

  const alertColor = { hoy: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "#D97706" }, maniana: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "#1D4ED8" }, vencido: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: C.red } };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: L.bg, fontFamily: FONT_BODY }}>

      {/* ── Header ── */}
      <div style={{ background: L.white, borderBottom: `3px solid ${C.gold}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 52, objectFit: "contain" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15, color: L.text, textTransform: "uppercase", letterSpacing: 0.4 }}>Panel de Vendedor</div>
          <div style={{ fontSize: 12, color: L.muted }}>{vendorInfo.nombre}</div>
        </div>
        {notifs.length > 0 && (
          <button onClick={() => setShowNotifs(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "7px 14px", cursor: "pointer" }}>
            <Bell size={15} color={C.red} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{notifs.length} alerta{notifs.length > 1 ? "s" : ""}</span>
          </button>
        )}
        <button onClick={onLogout} title="Cerrar sesión"
          style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogOut size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>

        {/* ── Alertas ── */}
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

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
          {[
            { icon: <ShoppingBag size={18} />, label: "Total pedidos", value: stats.total, color: "#1D4ED8", bg: "#EFF6FF" },
            { icon: <Clock size={18} />, label: "En proceso", value: stats.enProceso, color: "#D97706", bg: "#FFFBEB" },
            { icon: <CheckCircle size={18} />, label: "Entregados", value: stats.entregados, color: "#15803D", bg: "#DCFCE7" },
          ].map(s => (
            <div key={s.label} style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT_DISPLAY, color: s.color, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: L.muted, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* ── Tabla de pedidos ── */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Barra de filtros */}
            <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <Search size={13} color={L.light} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente, producto…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 29px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
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
            </div>

            {/* Pedidos */}
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
                <div key={ped.id} style={{ background: L.white, border: `1.5px solid ${borderColor}`, borderRadius: 12, marginBottom: 10, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,.04)", transition: "box-shadow .15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)"}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>

                    {/* Izquierda */}
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: L.text }}>
                          {cont.nombre || cont.telefono || "—"}
                        </span>
                        {cont.empresa && <span style={{ fontSize: 11.5, color: L.muted }}>· {cont.empresa}</span>}
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: ep.bg, color: ep.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{ep.label}</span>
                      </div>

                      {/* Items */}
                      <div style={{ fontSize: 13, color: L.muted, marginBottom: 8, lineHeight: 1.5 }}>
                        {det.items.filter(i => i.desc?.trim()).slice(0, 4).map((it, idx) => (
                          <span key={idx}>{idx > 0 ? " · " : ""}
                            <strong style={{ color: L.text }}>{it.qty}×</strong> {it.desc}
                          </span>
                        ))}
                        {det.items.filter(i => i.desc?.trim()).length > 4 && (
                          <span style={{ color: L.light }}> +{det.items.filter(i => i.desc?.trim()).length - 4} más</span>
                        )}
                      </div>

                      {/* Meta */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        {cont.telefono && (
                          <span style={{ fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <Phone size={11} /> {cont.telefono}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 3 }}>
                          <Package size={11} /> {det.entrega}
                        </span>
                        {det.entrega === "Delivery" && det.direccion && (
                          <span style={{ fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={11} /> {det.direccion.slice(0, 35)}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: L.muted }}>{det.pago}</span>
                        {det.notas?.trim() && (
                          <span style={{ fontSize: 12, color: "#D97706" }}>📝 {det.notas.slice(0, 50)}</span>
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
                          style={{ display: "flex", alignItems: "center", gap: 6, background: fe ? (alertaFecha ? (isVencido(fe) ? "#FEF2F2" : "#FFFBEB") : L.soft) : L.soft, border: `1px solid ${fe ? (alertaFecha ? (isVencido(fe) ? "#FECACA" : "#FDE68A") : L.border) : L.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: fe ? 700 : 400, color: fe ? (isHoy(fe) ? "#D97706" : isVencido(fe) ? C.red : L.muted) : L.light, transition: "all .15s" }}>
                          <Calendar size={12} />
                          {fe ? fmtDate(fe) : "Fecha entrega"}
                          {isHoy(fe) && <span style={{ fontSize: 9.5, background: "#FDE68A", color: "#92400E", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>HOY</span>}
                          {isVencido(fe) && <span style={{ fontSize: 9.5, background: "#FECACA", color: C.red, borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>VENCIDA</span>}
                        </button>
                      )}

                      {/* Estado select */}
                      <select value={ped.estado} onChange={e => updateEstado(ped.id, e.target.value)}
                        style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${ep.color}40`, fontSize: 12.5, fontFamily: FONT_BODY, background: ep.bg, color: ep.color, cursor: "pointer", outline: "none", fontWeight: 700 }}>
                        {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>

                      {/* PDF */}
                      <button onClick={() => imprimirPedido(ped, cont)} title="Descargar PDF"
                        style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, color: L.muted, fontFamily: FONT_BODY, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = L.muted; e.currentTarget.style.borderColor = L.border; }}>
                        <Download size={12} /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Calendario ── */}
          <div style={{ width: 270, flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} color={C.red} /> Calendario de entregas
            </div>
            <MiniCalendar pedidos={pedidos} onSelectDate={setSelectedDate} selectedDate={selectedDate} />

            {selectedDate && (
              <div style={{ marginTop: 12, background: L.white, border: `1px solid ${L.border}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: L.muted, marginBottom: 10, textTransform: "capitalize" }}>
                  {new Date(selectedDate + "T12:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {pedidos
                  .filter(p => { const fe = parseDet(p.detalle).fecha_entrega; return fe && fe.startsWith(selectedDate); })
                  .map(p => {
                    const cont = contactos[p.contacto_id] || {};
                    const ep = EP[p.estado] || EP.pendiente;
                    return (
                      <div key={p.id} style={{ padding: "8px 0", borderTop: `1px solid ${L.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: L.text, fontSize: 13 }}>{cont.nombre || cont.telefono || "—"}</span>
                          <span style={{ padding: "1px 7px", borderRadius: 6, background: ep.bg, color: ep.color, fontSize: 10.5, fontWeight: 700 }}>{ep.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: L.muted, marginTop: 2 }}>{parseDet(p.detalle).entrega}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
