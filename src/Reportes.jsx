import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  MessageSquare, Users, UserPlus, Target, Package,
  Clock, Bot, AlertTriangle, DollarSign, Receipt,
  TrendingUp, Download, FileText, ArrowDownToLine,
} from "lucide-react";
import {
  supabase, C, FONT_DISPLAY, FONT_BODY, VENDEDORES, ESTADOS,
  rangoFechas, fmtFecha, fmtFechaLarga, fmtMoneda, exportarCSV,
} from "./lib";

const PALETA = ["#9C1B1B", "#6366F1", "#D4A13A", "#0891B2", "#5D6B3A", "#EA580C", "#16A34A", "#BE185D"];

// Design tokens
const T = {
  bg:     "#F1F5F9",
  white:  "#FFFFFF",
  border: "#E2E8F0",
  text:   "#0F172A",
  sub:    "#374151",
  muted:  "#64748B",
  light:  "#94A3B8",
  soft:   "#F8FAFC",
};

function etiqueta(p) {
  return { dia: "Hoy", semana: "Últimos 7 días", mes: "Últimos 30 días", anio: "Este año" }[p] || p;
}

function fmtMin(min) {
  if (min === null || min === undefined || isNaN(min)) return "—";
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── KPI CARD ──────────────────────────────────────────────────────────────
function Kpi({ Icon, label, valor, sub, iconColor = C.red, iconBg = "#FEF2F2", alert }) {
  return (
    <div style={{
      background: T.white, borderRadius: 10, padding: "18px 20px",
      border: `1px solid ${alert ? "#FECACA" : T.border}`,
      boxShadow: alert ? "0 0 0 3px rgba(252,165,165,.2)" : "0 1px 3px rgba(0,0,0,.05)",
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, lineHeight: 1.4 }}>
          {label}
        </span>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={iconColor} strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: T.text, marginTop: 10, lineHeight: 1.1 }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.light, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

// ─── PANEL ─────────────────────────────────────────────────────────────────
function Panel({ titulo, children, style, badge }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 22px", boxShadow: "0 1px 3px rgba(0,0,0,.05)", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.soft}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.sub, letterSpacing: 0.1 }}>{titulo}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ─── FUNNEL ────────────────────────────────────────────────────────────────
function Funnel({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {data.map((d, i) => (
        <div key={d.name}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: T.sub }}>{d.name}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: PALETA[i % PALETA.length] }}>{d.value}</span>
          </div>
          <div style={{ height: 5, background: T.soft, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              width: `${Math.round(d.value / max * 100)}%`,
              background: PALETA[i % PALETA.length],
              minWidth: d.value > 0 ? 5 : 0,
              transition: "width .5s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TOOLTIP OSCURO ────────────────────────────────────────────────────────
function TooltipDark({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1E293B", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      <div style={{ fontWeight: 600, color: "#E2E8F0", marginBottom: 7, fontSize: 11.5 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#94A3B8" }}>{p.name}:</span>
          <strong style={{ color: "#F8FAFC" }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ─── BADGE ─────────────────────────────────────────────────────────────────
function Badge({ children }) {
  return (
    <span style={{ fontSize: 11, background: T.soft, color: T.muted, padding: "3px 10px", borderRadius: 20, fontWeight: 600, border: `1px solid ${T.border}` }}>
      {children}
    </span>
  );
}

// ─── BOTON EXPORT ──────────────────────────────────────────────────────────
function BtnExport({ onClick, Icon: Ic, label, variant = "outline" }) {
  const base = {
    display: "flex", alignItems: "center", gap: 6,
    border: "none", borderRadius: 8, padding: "8px 16px",
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY,
    transition: "all .15s",
  };
  const styles = {
    red:     { ...base, background: C.red, color: "#fff" },
    green:   { ...base, background: "#16A34A", color: "#fff" },
    outline: { ...base, background: T.white, color: T.sub, border: `1px solid ${T.border}` },
  };
  return <button onClick={onClick} style={styles[variant]}><Ic size={13} strokeWidth={2.5} /> {label}</button>;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function shortId(id) { return (id || "").slice(0, 6).toUpperCase(); }
function parseDet(det) {
  if (!det) return { items: [], notas: "", entrega: "Retiro en local", direccion: "", pago: "Efectivo" };
  try {
    const p = JSON.parse(det);
    return p.items ? p : { items: [{ desc: det, qty: 1, precio: 0 }], notas: "", entrega: "Retiro en local", direccion: "", pago: "Efectivo" };
  } catch {
    return { items: [{ desc: det, qty: 1, precio: 0 }], notas: "", entrega: "Retiro en local", direccion: "", pago: "Efectivo" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function Reportes() {
  const [vista, setVista]     = useState("stats");
  const [periodo, setPeriodo] = useState("semana");
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState(null);

  const [pDesde, setPDesde]         = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); });
  const [pHasta, setPHasta]         = useState(hoyISO);
  const [pedResult, setPedResult]   = useState(null);
  const [loadingPed, setLoadingPed] = useState(false);

  const [mDesde, setMDesde]         = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const [mHasta, setMHasta]         = useState(hoyISO);
  const [msgResult, setMsgResult]   = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(false);

  // ── Buscar mensajes ──────────────────────────────────────────────────────
  const buscarMensajes = async () => {
    setLoadingMsg(true);
    const { data: mensajes, error } = await supabase
      .from("mensajes").select("*")
      .gte("created_at", mDesde + "T00:00:00")
      .lte("created_at", mHasta + "T23:59:59")
      .order("created_at", { ascending: true });
    if (error || !mensajes) { setLoadingMsg(false); setMsgResult([]); return; }
    const ids = [...new Set(mensajes.map((m) => m.contacto_id).filter(Boolean))];
    let contactosMap = {};
    if (ids.length > 0) {
      const { data: conts } = await supabase.from("contactos").select("id,nombre,telefono,empresa").in("id", ids);
      (conts || []).forEach((c) => { contactosMap[c.id] = c; });
    }
    setLoadingMsg(false);
    setMsgResult(mensajes.map((m) => ({ ...m, contactos: contactosMap[m.contacto_id] || null })));
  };

  const exportarMsgCSV = () => {
    if (!msgResult?.length) return;
    exportarCSV(msgResult.map((m) => ({
      Fecha: new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      Dirección: m.direccion === "in" ? "Cliente → CRM" : "CRM → Cliente",
      Origen: m.origen || "", Agente: m.agente || "",
      Cliente: m.contactos?.nombre || m.contactos?.telefono || "",
      Teléfono: m.contactos?.telefono || "", Empresa: m.contactos?.empresa || "",
      Mensaje: m.contenido || "",
    })), `mensajes-nm-${mDesde}-al-${mHasta}`);
  };

  const exportarMsgPDF = () => {
    if (!msgResult?.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(156, 27, 27); doc.rect(0, 0, 297, 22, "F");
    doc.setFillColor(212, 161, 58); doc.rect(0, 19, 297, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(16);
    doc.text("Nuevo Munich — Historial de Mensajes", 14, 13);
    doc.setFontSize(9); doc.text(`${mDesde} al ${mHasta} · ${msgResult.length} mensajes`, 14, 19.5);
    autoTable(doc, {
      startY: 28,
      head: [["Fecha","Dir.","Origen","Agente","Cliente","Teléfono","Mensaje"]],
      body: msgResult.map((m) => [
        new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        m.direccion === "in" ? "↙ Cliente" : "↗ Agente",
        m.origen || "—", m.agente || "—",
        m.contactos?.nombre || m.contactos?.telefono || "—",
        m.contactos?.telefono || "—", m.contenido || "",
      ]),
      headStyles: { fillColor: [156, 27, 27], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      columnStyles: { 6: { cellWidth: 90 } },
      alternateRowStyles: { fillColor: [252, 248, 240] },
    });
    doc.setFontSize(7.5); doc.setTextColor(140, 132, 114);
    doc.text(`Generado el ${new Date().toLocaleString("es-AR")} · Munich CRM`, 14, doc.lastAutoTable.finalY + 8);
    doc.save(`mensajes-nm-${mDesde}-al-${mHasta}.pdf`);
  };

  // ── Buscar pedidos ───────────────────────────────────────────────────────
  const buscarPedidos = async () => {
    setLoadingPed(true);
    const { data: pedidos, error } = await supabase
      .from("pedidos").select("*")
      .gte("created_at", pDesde + "T00:00:00")
      .lte("created_at", pHasta + "T23:59:59")
      .order("created_at", { ascending: false });
    if (error || !pedidos) { setLoadingPed(false); setPedResult([]); return; }
    const ids = [...new Set(pedidos.map((p) => p.contacto_id).filter(Boolean))];
    let contactosMap = {};
    if (ids.length > 0) {
      const { data: conts } = await supabase.from("contactos").select("id,nombre,telefono,empresa").in("id", ids);
      (conts || []).forEach((c) => { contactosMap[c.id] = c; });
    }
    setLoadingPed(false);
    setPedResult(pedidos.map((p) => ({ ...p, contactos: contactosMap[p.contacto_id] || null })));
  };

  const exportarPedidosCSV = () => {
    if (!pedResult?.length) return;
    const filas = [];
    for (const p of pedResult) {
      const det = parseDet(p.detalle);
      const cliente = p.contactos?.nombre || p.contactos?.telefono || p.contacto_id;
      const telefono = p.contactos?.telefono || "";
      const empresa  = p.contactos?.empresa || "";
      const fecha    = new Date(p.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      if (det.items.length === 0) {
        filas.push({ "N° Pedido": shortId(p.id), Fecha: fecha, Cliente: cliente, Teléfono: telefono, Empresa: empresa, Vendedor: p.vendedor || "", Estado: p.estado || "", Artículo: "", Cantidad: "", "Precio unit.": "", Subtotal: "", Notas: det.notas, Entrega: det.entrega, Dirección: det.direccion, Pago: det.pago, Total: p.total || 0 });
      } else {
        det.items.forEach((it, idx) => {
          filas.push({ "N° Pedido": idx === 0 ? shortId(p.id) : "", Fecha: idx === 0 ? fecha : "", Cliente: idx === 0 ? cliente : "", Teléfono: idx === 0 ? telefono : "", Empresa: idx === 0 ? empresa : "", Vendedor: idx === 0 ? (p.vendedor || "") : "", Estado: idx === 0 ? (p.estado || "") : "", Artículo: it.desc, Cantidad: it.qty, "Precio unit.": it.precio, Subtotal: (Number(it.qty) || 0) * (Number(it.precio) || 0), Notas: idx === 0 ? det.notas : "", Entrega: idx === 0 ? det.entrega : "", Dirección: idx === 0 ? det.direccion : "", Pago: idx === 0 ? det.pago : "", Total: idx === 0 ? (p.total || 0) : "" });
        });
      }
    }
    exportarCSV(filas, `pedidos-nm-${pDesde}-al-${pHasta}`);
  };

  const exportarPedidosPDF = () => {
    if (!pedResult?.length) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFillColor(156, 27, 27); doc.rect(0, 0, 297, 22, "F");
    doc.setFillColor(212, 161, 58); doc.rect(0, 19, 297, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(16);
    doc.text("Nuevo Munich — Reporte de Pedidos", 14, 13);
    doc.setFontSize(9); doc.text(`${pDesde} al ${pHasta} · ${pedResult.length} pedidos`, 14, 19.5);
    const body = [];
    for (const p of pedResult) {
      const det = parseDet(p.detalle);
      const cliente = p.contactos?.nombre || p.contactos?.telefono || "";
      const tel    = p.contactos?.telefono || "";
      const fecha  = new Date(p.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const articulos = det.items.map((i) => `${i.qty}x ${i.desc}`).join("\n") || "—";
      body.push([shortId(p.id), fecha, cliente, tel, p.vendedor || "—", p.estado || "—", articulos, det.entrega, det.pago, fmtMoneda(p.total)]);
    }
    autoTable(doc, {
      startY: 28,
      head: [["N°","Fecha","Cliente","Teléfono","Vendedor","Estado","Artículos","Entrega","Pago","Total"]],
      body,
      headStyles: { fillColor: [156, 27, 27], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      columnStyles: { 6: { cellWidth: 55 } },
      alternateRowStyles: { fillColor: [252, 248, 240] },
    });
    const tot = pedResult.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10); doc.setTextColor(40, 30, 20);
    doc.text(`Total facturado: ${fmtMoneda(tot)}`, 14, y);
    doc.setFontSize(7.5); doc.setTextColor(140, 132, 114);
    doc.text(`Generado el ${new Date().toLocaleString("es-AR")} · Munich CRM`, 14, y + 6);
    doc.save(`pedidos-nm-${pDesde}-al-${pHasta}.pdf`);
  };

  // ── Cargar estadísticas ──────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    const { inicio, fin } = rangoFechas(periodo);
    const iso = inicio.toISOString();
    const [msgsRes, contRes, pedRes] = await Promise.all([
      supabase.from("mensajes").select("id,direccion,origen,agente,created_at,contacto_id").gte("created_at", iso),
      supabase.from("contactos").select("id,vendedor,estado,created_at,bot_activo,seguimiento_at,ultimo_in_at,ultimo_out_at"),
      supabase.from("pedidos").select("vendedor,total,estado,created_at").gte("created_at", iso),
    ]);
    const msgs      = msgsRes.data || [];
    const contactos = contRes.data || [];
    const pedidos   = pedRes.data  || [];
    const nuevos    = contactos.filter((c) => new Date(c.created_at) >= inicio);
    const activosSet = new Set(msgs.filter((m) => m.direccion === "in").map((m) => m.contacto_id));
    const contactosActivos = activosSet.size;
    const dias = {};
    const cur = new Date(inicio);
    while (cur <= fin) {
      const k = cur.toISOString().slice(0, 10);
      dias[k] = { dia: fmtFecha(cur), clientes: 0, respuestas: 0, nuevos: 0 };
      cur.setDate(cur.getDate() + 1);
    }
    for (const m of msgs) {
      const k = m.created_at.slice(0, 10);
      if (dias[k]) { if (m.direccion === "in") dias[k].clientes++; else dias[k].respuestas++; }
    }
    for (const c of nuevos) {
      const k = c.created_at.slice(0, 10);
      if (dias[k]) dias[k].nuevos++;
    }
    const serie = Object.values(dias);
    const horarios = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, clientes: 0, respuestas: 0 }));
    for (const m of msgs) {
      const h = new Date(m.created_at).getHours();
      if (m.direccion === "in") horarios[h].clientes++; else horarios[h].respuestas++;
    }
    const botCount    = msgs.filter((m) => m.origen === "bot").length;
    const agenteCount = msgs.filter((m) => m.origen === "agente").length;
    const botPct      = botCount + agenteCount > 0 ? Math.round(botCount / (botCount + agenteCount) * 100) : 0;
    const porVendedor = VENDEDORES.map((v) => {
      const cont     = contactos.filter((c) => c.vendedor === v);
      const ped      = pedidos.filter((p) => p.vendedor === v);
      const msgsV    = msgs.filter((m) => m.agente === v).length;
      const nuevosV  = nuevos.filter((c) => c.vendedor === v).length;
      const cerrados = cont.filter((c) => ["pedido","cerrado","vendido"].includes(c.estado)).length;
      return { vendedor: v, contactos: cont.length, nuevos: nuevosV, cerrados, conversion: cont.length ? Math.round(cerrados / cont.length * 100) : 0, pedidos: ped.length, facturacion: ped.reduce((s, p) => s + (Number(p.total) || 0), 0), mensajes: msgsV };
    });
    const vendedoresActivos = porVendedor.filter((v) => v.contactos > 0 || v.mensajes > 0);
    const porEstado = Object.entries(ESTADOS).map(([k, v]) => ({ name: v.label, value: contactos.filter((c) => c.estado === k).length }));
    const cerradosTot    = contactos.filter((c) => ["pedido","cerrado","vendido"].includes(c.estado)).length;
    const tasaConversion = contactos.length ? Math.round(cerradosTot / contactos.length * 100) : 0;
    const botAutonomo    = contactos.filter((c) => c.bot_activo).length;
    const agenteManual   = contactos.filter((c) => !c.bot_activo).length;
    const ahora = new Date();
    const segVencidos = contactos.filter((c) => c.seguimiento_at && new Date(c.seguimiento_at) < ahora).length;
    const tiemposMin = contactos.filter((c) => c.ultimo_in_at && c.ultimo_out_at)
      .map((c) => (new Date(c.ultimo_out_at) - new Date(c.ultimo_in_at)) / 60000)
      .filter((t) => t > 0 && t < 1440);
    const tiempoPromMin = tiemposMin.length ? tiemposMin.reduce((a, b) => a + b, 0) / tiemposMin.length : null;
    const facturacion  = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const totalPedidos = pedidos.length;
    const ticket       = totalPedidos ? facturacion / totalPedidos : 0;
    setData({ serie, horarios, porVendedor, vendedoresActivos, porEstado, kpis: { msgsIn: msgs.filter((m) => m.direccion === "in").length, msgsTotal: msgs.length, contactosActivos, nuevos: nuevos.length, totalContactos: contactos.length, cerradosTot, tasaConversion, totalPedidos, facturacion, ticket, botCount, agenteCount, botPct, botAutonomo, agenteManual, segVencidos, tiempoPromMin }, periodo, inicio, fin });
    setLoading(false);
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Exportar PDF de estadísticas ─────────────────────────────────────────
  const exportarPDF = () => {
    if (!data) return;
    const { kpis, porVendedor } = data;
    const doc = new jsPDF();
    doc.setFillColor(156, 27, 27); doc.rect(0, 0, 210, 32, "F");
    doc.setFillColor(212, 161, 58); doc.rect(0, 29, 210, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(20);
    doc.text("Nuevo Munich CRM — Reporte", 14, 14);
    doc.setFontSize(9); doc.text(`${etiqueta(periodo)} · ${fmtFechaLarga(data.inicio)} — ${fmtFechaLarga(data.fin)}`, 14, 24);
    doc.setTextColor(40, 30, 20); doc.setFontSize(14); doc.text("Resumen del período", 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [["Métrica", "Valor"]],
      body: [
        ["Mensajes de clientes", String(kpis.msgsIn)],
        ["Contactos únicos activos", String(kpis.contactosActivos)],
        ["Nuevos contactos", String(kpis.nuevos)],
        ["Total contactos (acumulado)", String(kpis.totalContactos)],
        ["Tasa de conversión global", `${kpis.tasaConversion}% (${kpis.cerradosTot} de ${kpis.totalContactos})`],
        ["Pedidos", String(kpis.totalPedidos)],
        ["Facturación", fmtMoneda(kpis.facturacion)],
        ["Ticket promedio", fmtMoneda(kpis.ticket)],
        ["Atendido por bot", `${kpis.botPct}% (${kpis.botCount} mensajes)`],
        ["Tiempo prom. respuesta", fmtMin(kpis.tiempoPromMin)],
        ["Seguimientos vencidos", String(kpis.segVencidos)],
      ],
      headStyles: { fillColor: [156, 27, 27] },
      styles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [252, 248, 240] },
    });
    const y2 = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(14); doc.text("Rendimiento por vendedor", 14, y2);
    autoTable(doc, {
      startY: y2 + 4,
      head: [["Vendedor","Contactos","Nuevos","Cerrados","Conv.%","Pedidos","Facturación","Mensajes"]],
      body: porVendedor.map((v) => [v.vendedor, v.contactos, v.nuevos, v.cerrados, `${v.conversion}%`, v.pedidos, fmtMoneda(v.facturacion), v.mensajes]),
      headStyles: { fillColor: [212, 161, 58], textColor: [40, 30, 20] },
      styles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [252, 248, 240] },
    });
    doc.setFontSize(8); doc.setTextColor(140, 132, 114);
    doc.text(`Generado el ${new Date().toLocaleString("es-AR")} · Munich CRM`, 14, 285);
    doc.save(`reporte-nm-${periodo}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportarCSVBtn = () => {
    if (!data) return;
    exportarCSV(data.porVendedor.map((v) => ({ Vendedor: v.vendedor, Contactos: v.contactos, "Nuevos período": v.nuevos, Cerrados: v.cerrados, "Conversión %": v.conversion, Pedidos: v.pedidos, Facturación: v.facturacion, Mensajes: v.mensajes })), `vendedores-nm-${periodo}`);
  };

  // ── Estilos comunes ──────────────────────────────────────────────────────
  const inputStyle = {
    padding: "9px 13px", borderRadius: 8, border: `1.5px solid ${T.border}`,
    fontSize: 13.5, fontFamily: FONT_BODY, color: T.text, outline: "none",
    background: T.soft, transition: "border .15s",
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ flex: 1, height: "100vh", overflowY: "auto", background: T.bg, fontFamily: FONT_BODY }}>

      {/* ── HEADER ── */}
      <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: "14px 28px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>

          {/* Título + subtítulo */}
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.2 }}>
              {vista === "stats" ? "Reportes y Estadísticas" : "Reporte de Pedidos"}
            </div>
            {vista === "stats" && data && !loading && (
              <div style={{ fontSize: 11.5, color: T.light, marginTop: 2 }}>
                {etiqueta(periodo)} · {fmtFechaLarga(data.inicio)} — {fmtFechaLarga(data.fin)}
              </div>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Pestañas vista */}
            <div style={{ display: "flex", gap: 0, background: T.soft, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
              {[["stats","Estadísticas"],["pedidos","Pedidos"]].map(([k, l]) => (
                <button key={k} onClick={() => setVista(k)}
                  style={{ border: "none", borderRadius: 7, padding: "7px 18px", fontSize: 12.5, cursor: "pointer", fontWeight: 600, fontFamily: FONT_BODY, transition: "all .15s",
                    background: vista === k ? (k === "pedidos" ? C.red : T.text) : "transparent",
                    color: vista === k ? "#fff" : T.muted }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Período */}
            {vista === "stats" && (
              <>
                <div style={{ display: "flex", gap: 0, background: T.soft, padding: 3, borderRadius: 9, border: `1px solid ${T.border}` }}>
                  {[["dia","Hoy"],["semana","Semana"],["mes","Mes"],["anio","Año"]].map(([k, l]) => (
                    <button key={k} onClick={() => setPeriodo(k)}
                      style={{ border: "none", borderRadius: 7, padding: "7px 13px", fontSize: 12.5, cursor: "pointer", fontWeight: 600, fontFamily: FONT_BODY, transition: "all .15s",
                        background: periodo === k ? C.red : "transparent",
                        color: periodo === k ? "#fff" : T.muted }}>
                      {l}
                    </button>
                  ))}
                </div>
                <BtnExport onClick={exportarPDF} Icon={FileText} label="PDF" variant="red" />
                <BtnExport onClick={exportarCSVBtn} Icon={ArrowDownToLine} label="CSV" variant="green" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          VISTA: PEDIDOS
      ══════════════════════════════════════════════════════════════ */}
      {vista === "pedidos" && (
        <div style={{ padding: "24px 28px" }}>
          <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 10, padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>

            {/* Filtros de fecha */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
              {[["Desde", pDesde, setPDesde],["Hasta", pHasta, setPHasta]].map(([lbl, val, set]) => (
                <div key={lbl}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{lbl}</div>
                  <input type="date" value={val} onChange={(e) => set(e.target.value)} style={inputStyle} />
                </div>
              ))}
              <button onClick={buscarPedidos} disabled={loadingPed}
                style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT_BODY, minWidth: 110, opacity: loadingPed ? 0.7 : 1 }}>
                {loadingPed ? "Buscando…" : "Buscar"}
              </button>
              {pedResult?.length > 0 && (
                <>
                  <BtnExport onClick={exportarPedidosPDF} Icon={FileText} label="PDF" variant="red" />
                  <BtnExport onClick={exportarPedidosCSV} Icon={ArrowDownToLine} label="CSV" variant="green" />
                </>
              )}
            </div>

            {pedResult === null && (
              <div style={{ color: T.light, fontSize: 14, padding: "48px 0", textAlign: "center" }}>
                Seleccioná un rango y hacé clic en <strong style={{ color: T.muted }}>Buscar</strong>
              </div>
            )}
            {pedResult !== null && pedResult.length === 0 && (
              <div style={{ color: T.light, fontSize: 14, padding: "48px 0", textAlign: "center" }}>
                No hay pedidos en ese rango de fechas
              </div>
            )}
            {pedResult?.length > 0 && (
              <>
                {/* Resumen */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
                  {[
                    ["Pedidos totales", pedResult.length],
                    ["Facturación", fmtMoneda(pedResult.reduce((s, p) => s + (Number(p.total) || 0), 0))],
                    ["Ticket promedio", fmtMoneda(pedResult.reduce((s, p) => s + (Number(p.total) || 0), 0) / pedResult.length)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ padding: "14px 16px", background: T.soft, borderRadius: 8, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: 0.7 }}>{l}</div>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: T.text, marginTop: 6 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Tabla */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}`, background: T.soft }}>
                        {["N°","Fecha","Cliente","Teléfono","Vendedor","Estado","Productos","Notas","Entrega","Dirección","Pago","Total"].map((h) => (
                          <th key={h} style={{ padding: "9px 12px", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: T.muted, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pedResult.map((p, i) => {
                        const det = parseDet(p.detalle);
                        const cliente = p.contactos?.nombre || p.contactos?.telefono || "—";
                        const tel   = p.contactos?.telefono || "—";
                        const fecha = new Date(p.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                        const eColor = { pendiente: "#92400E", confirmado: "#1D4ED8", preparando: "#7C3AED", listo: "#15803D", entregado: "#374151", cancelado: "#B91C1C" }[p.estado] || T.muted;
                        const eBg   = { pendiente: "#FEF3C7", confirmado: "#DBEAFE", preparando: "#EDE9FE", listo: "#DCFCE7", entregado: "#F3F4F6", cancelado: "#FEE2E2" }[p.estado] || T.soft;
                        return (
                          <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? T.white : T.soft }}>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: T.muted, whiteSpace: "nowrap", fontSize: 11.5, fontFamily: "monospace" }}>{shortId(p.id)}</td>
                            <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: T.muted, fontSize: 12 }}>{fecha}</td>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: T.text, whiteSpace: "nowrap" }}>{cliente}</td>
                            <td style={{ padding: "9px 12px", color: T.muted, whiteSpace: "nowrap", fontSize: 12 }}>{tel}</td>
                            <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: T.sub }}>{p.vendedor || "—"}</td>
                            <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                              <span style={{ background: eBg, color: eColor, padding: "2px 9px", borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{p.estado || "—"}</span>
                            </td>
                            <td style={{ padding: "9px 12px", minWidth: 180 }}>
                              {det.items.length > 0
                                ? det.items.map((it, k) => (
                                    <div key={k} style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                                      <strong>{it.qty}×</strong> {it.desc}{it.precio ? <span style={{ color: T.muted }}> — {fmtMoneda(it.precio)}</span> : ""}
                                    </div>
                                  ))
                                : "—"}
                            </td>
                            <td style={{ padding: "9px 12px", color: T.muted, fontSize: 12, maxWidth: 150 }}>{det.notas || "—"}</td>
                            <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: T.sub }}>{det.entrega || "—"}</td>
                            <td style={{ padding: "9px 12px", color: T.muted, fontSize: 12, maxWidth: 140 }}>{det.direccion || "—"}</td>
                            <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: T.sub }}>{det.pago || "—"}</td>
                            <td style={{ padding: "9px 12px", fontWeight: 700, color: "#16A34A", whiteSpace: "nowrap", fontSize: 14 }}>{fmtMoneda(p.total)}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: `2px solid ${T.border}`, background: T.soft, fontWeight: 700 }}>
                        <td colSpan={11} style={{ padding: "10px 12px", color: T.sub, fontSize: 12.5 }}>{pedResult.length} pedidos</td>
                        <td style={{ padding: "10px 12px", color: "#16A34A", fontWeight: 800, fontSize: 14 }}>{fmtMoneda(pedResult.reduce((s, p) => s + (Number(p.total) || 0), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          VISTA: ESTADÍSTICAS
      ══════════════════════════════════════════════════════════════ */}
      {vista === "stats" && (loading || !data
        ? <div style={{ padding: 80, textAlign: "center", color: T.light, fontSize: 14 }}>Cargando estadísticas…</div>
        : (
          <div style={{ padding: "22px 28px" }}>

            {/* ── FILA 1 DE KPIs ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 12, marginBottom: 12 }}>
              <Kpi Icon={MessageSquare} label="Mensajes de clientes" valor={data.kpis.msgsIn}
                sub={`${data.kpis.msgsTotal} totales en el período`}
                iconColor={C.red} iconBg="#FEF2F2" />
              <Kpi Icon={Users} label="Contactos activos" valor={data.kpis.contactosActivos}
                sub={`de ${data.kpis.totalContactos} en total`}
                iconColor="#6366F1" iconBg="#EEF2FF" />
              <Kpi Icon={UserPlus} label="Nuevos contactos" valor={data.kpis.nuevos}
                sub="creados en el período"
                iconColor="#D97706" iconBg="#FFFBEB" />
              <Kpi Icon={Target} label="Tasa de conversión" valor={`${data.kpis.tasaConversion}%`}
                sub={`${data.kpis.cerradosTot} cerrados / ${data.kpis.totalContactos} contactos`}
                iconColor="#16A34A" iconBg="#F0FDF4" />
            </div>

            {/* ── FILA 2 DE KPIs ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 12, marginBottom: 22 }}>
              <Kpi Icon={Package} label="Pedidos" valor={data.kpis.totalPedidos}
                sub="en el período"
                iconColor="#0891B2" iconBg="#ECFEFF" />
              <Kpi Icon={DollarSign} label="Facturación" valor={fmtMoneda(data.kpis.facturacion)}
                iconColor="#16A34A" iconBg="#F0FDF4" />
              <Kpi Icon={Receipt} label="Ticket promedio" valor={fmtMoneda(data.kpis.ticket)}
                iconColor="#EA580C" iconBg="#FFF7ED" />
              <Kpi Icon={Clock} label="T. resp. promedio" valor={fmtMin(data.kpis.tiempoPromMin)}
                sub="tiempo hasta primera respuesta"
                iconColor={T.muted} iconBg={T.soft} />
              <Kpi Icon={Bot} label="Mensajes bot" valor={`${data.kpis.botPct}%`}
                sub={`${data.kpis.agenteCount} por agentes`}
                iconColor="#7C3AED" iconBg="#F5F3FF" />
              {data.kpis.segVencidos > 0 && (
                <Kpi Icon={AlertTriangle} label="Seguimientos vencidos" valor={data.kpis.segVencidos}
                  sub="requieren atención"
                  iconColor={C.red} iconBg="#FEF2F2" alert />
              )}
            </div>

            {/* ── ACTIVIDAD DIARIA ── */}
            <Panel titulo="Actividad diaria — mensajes y nuevos contactos" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.serie} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <defs>
                    {[["gC", C.red],["gR", C.gold],["gN", "#5D6B3A"]].map(([id, color]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: T.light }} />
                  <YAxis tick={{ fontSize: 11, fill: T.light }} allowDecimals={false} />
                  <Tooltip content={<TooltipDark />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: T.muted }} />
                  <Area type="monotone" dataKey="clientes"   name="Clientes"   stroke={C.red}    fill="url(#gC)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="respuestas" name="Respuestas" stroke={C.gold}   fill="url(#gR)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="nuevos"     name="Nuevos"     stroke="#5D6B3A" fill="url(#gN)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            {/* ── HORAS PICO + PIPELINE ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16, marginBottom: 16 }}>

              <Panel titulo="Horas pico" badge={<Badge>por hora del día</Badge>}>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={data.horarios} margin={{ top: 5, right: 5, left: -20, bottom: 5 }} barSize={7}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 9.5, fill: T.light }} interval={1} />
                    <YAxis tick={{ fontSize: 10, fill: T.light }} allowDecimals={false} />
                    <Tooltip content={<TooltipDark />} />
                    <Legend wrapperStyle={{ fontSize: 11.5, color: T.muted }} />
                    <Bar dataKey="clientes"   name="Clientes"   fill={C.red}  radius={[3,3,0,0]} />
                    <Bar dataKey="respuestas" name="Respuestas" fill={C.gold} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel titulo="Pipeline de contactos" badge={<Badge>{data.kpis.totalContactos} total</Badge>}>
                <Funnel data={data.porEstado} />
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["Bot activo", data.kpis.botAutonomo, "#16A34A", "#F0FDF4"],
                    ["Agente manual", data.kpis.agenteManual, C.red, "#FEF2F2"],
                  ].map(([lbl, val, color, bg]) => (
                    <div key={lbl} style={{ padding: "12px 14px", background: bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* ── RENDIMIENTO POR VENDEDOR (GRÁFICO) ── */}
            <Panel titulo="Rendimiento por vendedor" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.vendedoresActivos.length > 0 ? data.vendedoresActivos : data.porVendedor}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="vendedor" tick={{ fontSize: 12, fill: T.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: T.light }} allowDecimals={false} />
                  <Tooltip content={<TooltipDark />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: T.muted }} />
                  <Bar dataKey="contactos" name="Contactos" fill={`${C.gold}bb`} radius={[4,4,0,0]} />
                  <Bar dataKey="cerrados"  name="Cerrados"  fill={C.red}          radius={[4,4,0,0]} />
                  <Bar dataKey="mensajes"  name="Mensajes"  fill="#6366F1"         radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* ── TABLA VENDEDORES ── */}
            <Panel titulo="Detalle por vendedor" style={{ marginBottom: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.border}`, background: T.soft }}>
                      {["Vendedor","Contactos","Nuevos","Cerrados","Conversión","Pedidos","Facturación","Mensajes"].map((h) => (
                        <th key={h} style={{ padding: "9px 12px", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, color: T.muted, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.porVendedor.map((v, i) => {
                      const esMejor = data.porVendedor.reduce((best, x) => x.cerrados > best.cerrados ? x : best, data.porVendedor[0])?.vendedor === v.vendedor && v.cerrados > 0;
                      return (
                        <tr key={v.vendedor} style={{ borderBottom: `1px solid ${T.border}`, background: esMejor ? "#FFFBEB" : i % 2 === 0 ? T.white : T.soft }}>
                          <td style={{ padding: "9px 12px", fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>
                            {esMejor && <TrendingUp size={12} color="#D97706" style={{ marginRight: 5, verticalAlign: "middle" }} />}
                            {v.vendedor}
                          </td>
                          <td style={{ padding: "9px 12px", color: T.sub }}>{v.contactos}</td>
                          <td style={{ padding: "9px 12px", color: T.sub }}>{v.nuevos}</td>
                          <td style={{ padding: "9px 12px", color: T.sub }}>{v.cerrados}</td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{
                              background: v.conversion >= 50 ? "#DCFCE7" : v.conversion >= 25 ? "#FEF9C3" : "#FEE2E2",
                              color: v.conversion >= 50 ? "#15803D" : v.conversion >= 25 ? "#854D0E" : C.redDark,
                              padding: "2px 9px", borderRadius: 4, fontWeight: 600, fontSize: 11.5,
                            }}>
                              {v.conversion}%
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", color: T.sub }}>{v.pedidos}</td>
                          <td style={{ padding: "9px 12px", color: T.sub, fontWeight: 600 }}>{fmtMoneda(v.facturacion)}</td>
                          <td style={{ padding: "9px 12px", color: T.sub }}>{v.mensajes}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: `2px solid ${T.border}`, background: T.soft, fontWeight: 700 }}>
                      <td style={{ padding: "9px 12px", color: T.text, fontSize: 12 }}>Total</td>
                      <td style={{ padding: "9px 12px" }}>{data.porVendedor.reduce((s, v) => s + v.contactos, 0)}</td>
                      <td style={{ padding: "9px 12px" }}>{data.porVendedor.reduce((s, v) => s + v.nuevos, 0)}</td>
                      <td style={{ padding: "9px 12px" }}>{data.porVendedor.reduce((s, v) => s + v.cerrados, 0)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ background: T.soft, color: T.sub, padding: "2px 9px", borderRadius: 4, fontWeight: 600, fontSize: 11.5, border: `1px solid ${T.border}` }}>
                          {data.kpis.tasaConversion}%
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>{data.kpis.totalPedidos}</td>
                      <td style={{ padding: "9px 12px", color: "#16A34A", fontWeight: 700 }}>{fmtMoneda(data.kpis.facturacion)}</td>
                      <td style={{ padding: "9px 12px" }}>{data.kpis.agenteCount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* ── PIE DISTRIBUCIÓN ── */}
            <Panel titulo="Distribución del pipeline">
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
                <ResponsiveContainer width={220} height={200}>
                  <PieChart>
                    <Pie data={data.porEstado.filter((e) => e.value > 0)} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={44} label={false} labelLine={false}>
                      {data.porEstado.map((e, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1E293B", border: "none", borderRadius: 8, fontSize: 12, color: "#F8FAFC" }} itemStyle={{ color: "#F8FAFC" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.porEstado.map((e, i) => (
                    <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: PALETA[i % PALETA.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: T.sub, fontWeight: 500, minWidth: 110 }}>{e.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text, minWidth: 28 }}>{e.value}</span>
                      <span style={{ fontSize: 11, color: T.light }}>
                        {data.kpis.totalContactos > 0 ? Math.round(e.value / data.kpis.totalContactos * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div style={{ height: 40 }} />
          </div>
        )
      )}
    </div>
  );
}
