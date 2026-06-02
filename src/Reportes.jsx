import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  supabase, C, FONT_DISPLAY, FONT_BODY, VENDEDORES, ESTADOS,
  rangoFechas, fmtFecha, fmtFechaLarga, fmtMoneda, exportarCSV,
} from "./lib";

const PALETA = [C.red, C.gold, C.sage, "#b5651d", "#6b4f2e", "#8a6a1e"];

export default function Reportes() {
  const [periodo, setPeriodo] = useState("semana"); // dia | semana | mes | anio
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { inicio, fin } = rangoFechas(periodo);
    const iso = inicio.toISOString();

    const [msgsRes, contRes, pedRes] = await Promise.all([
      supabase.from("mensajes").select("direccion,origen,agente,created_at").gte("created_at", iso),
      supabase.from("contactos").select("vendedor,estado,created_at"),
      supabase.from("pedidos").select("vendedor,total,estado,created_at").gte("created_at", iso),
    ]);

    const msgs = msgsRes.data || [];
    const contactos = contRes.data || [];
    const pedidos = pedRes.data || [];
    const nuevos = contactos.filter((c) => new Date(c.created_at) >= inicio);

    // --- Serie temporal (mensajes y nuevos contactos por día) ---
    const dias = {};
    const cursor = new Date(inicio);
    while (cursor <= fin) {
      const k = cursor.toISOString().slice(0, 10);
      dias[k] = { dia: fmtFecha(cursor), in: 0, out: 0, nuevos: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const m of msgs) {
      const k = m.created_at.slice(0, 10);
      if (dias[k]) dias[k][m.direccion === "in" ? "in" : "out"]++;
    }
    for (const c of nuevos) {
      const k = c.created_at.slice(0, 10);
      if (dias[k]) dias[k].nuevos++;
    }
    const serie = Object.values(dias);

    // --- Bot vs humano ---
    const botCount = msgs.filter((m) => m.origen === "bot").length;
    const agenteCount = msgs.filter((m) => m.origen === "agente").length;

    // --- Por vendedor ---
    const porVendedor = VENDEDORES.map((v) => {
      const cont = contactos.filter((c) => c.vendedor === v);
      const ped = pedidos.filter((p) => p.vendedor === v);
      const msgsV = msgs.filter((m) => m.agente === v).length;
      return {
        vendedor: v,
        contactos: cont.length,
        cerrados: cont.filter((c) => c.estado === "pedido" || c.estado === "cerrado").length,
        pedidos: ped.length,
        facturacion: ped.reduce((s, p) => s + (Number(p.total) || 0), 0),
        mensajes: msgsV,
      };
    });

    // --- Estados (embudo) ---
    const porEstado = Object.keys(ESTADOS).map((k) => ({
      name: ESTADOS[k].label,
      value: contactos.filter((c) => c.estado === k).length,
    }));

    // --- KPIs ---
    const totalPedidos = pedidos.length;
    const facturacion = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const ticket = totalPedidos ? facturacion / totalPedidos : 0;

    setData({
      serie, porVendedor, porEstado,
      kpis: {
        msgsTotal: msgs.length,
        msgsIn: msgs.filter((m) => m.direccion === "in").length,
        nuevos: nuevos.length,
        totalPedidos, facturacion, ticket,
        botCount, agenteCount,
        botPct: botCount + agenteCount ? Math.round((botCount / (botCount + agenteCount)) * 100) : 0,
      },
      periodo, inicio, fin,
    });
    setLoading(false);
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const exportarPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const { kpis, porVendedor } = data;
    doc.setFillColor(156, 27, 27);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Nuevo Munich — Reporte", 14, 13);
    doc.setFontSize(9);
    doc.text(`Período: ${etiquetaPeriodo(periodo)} · ${fmtFechaLarga(data.inicio)} a ${fmtFechaLarga(data.fin)}`, 14, 21);

    doc.setTextColor(40, 30, 20);
    doc.setFontSize(13);
    doc.text("Resumen", 14, 40);
    autoTable(doc, {
      startY: 44,
      head: [["Métrica", "Valor"]],
      body: [
        ["Mensajes totales", String(kpis.msgsTotal)],
        ["Mensajes de clientes", String(kpis.msgsIn)],
        ["Nuevos contactos", String(kpis.nuevos)],
        ["Pedidos", String(kpis.totalPedidos)],
        ["Facturación", fmtMoneda(kpis.facturacion)],
        ["Ticket promedio", fmtMoneda(kpis.ticket)],
        ["% atendido por bot", kpis.botPct + "%"],
      ],
      headStyles: { fillColor: [156, 27, 27] },
      styles: { fontSize: 10 },
    });

    doc.setFontSize(13);
    doc.text("Rendimiento por vendedor", 14, doc.lastAutoTable.finalY + 12);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [["Vendedor", "Contactos", "Cerrados", "Pedidos", "Facturación", "Mensajes"]],
      body: porVendedor.map((v) => [
        v.vendedor, v.contactos, v.cerrados, v.pedidos, fmtMoneda(v.facturacion), v.mensajes,
      ]),
      headStyles: { fillColor: [212, 161, 58] },
      styles: { fontSize: 9 },
    });

    doc.setFontSize(8);
    doc.setTextColor(140, 132, 114);
    doc.text(`Generado el ${new Date().toLocaleString("es-AR")}`, 14, 285);
    doc.save(`reporte-nuevomunich-${periodo}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportarVendedoresCSV = () => {
    if (!data) return;
    exportarCSV(
      data.porVendedor.map((v) => ({
        Vendedor: v.vendedor, Contactos: v.contactos, Cerrados: v.cerrados,
        Pedidos: v.pedidos, Facturacion: v.facturacion, Mensajes: v.mensajes,
      })),
      `vendedores-${periodo}`
    );
  };

  return (
    <div style={{ flex: 1, height: "100vh", overflowY: "auto", background: C.cream }}>
      {/* Header */}
      <div style={{ background: C.paper, borderBottom: `1px solid ${C.border}`, padding: "16px 26px", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: C.charcoal, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Reportes y estadísticas
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, background: "#fff", padding: 4, borderRadius: 8, border: `1px solid ${C.border}` }}>
              {[["dia", "Hoy"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"]].map(([k, l]) => (
                <button key={k} onClick={() => setPeriodo(k)}
                  style={{ border: "none", borderRadius: 5, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700, fontFamily: FONT_BODY,
                    background: periodo === k ? C.red : "transparent", color: periodo === k ? "#fff" : C.muted }}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={exportarPDF} style={btnExp}>↓ PDF</button>
            <button onClick={exportarVendedoresCSV} style={{ ...btnExp, background: C.sage }}>↓ CSV</button>
          </div>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ padding: 60, textAlign: "center", color: C.muted }}>Cargando estadísticas…</div>
      ) : (
        <div style={{ padding: 26 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 14, marginBottom: 24 }}>
            <Kpi label="Mensajes" valor={data.kpis.msgsTotal} sub={`${data.kpis.msgsIn} de clientes`} />
            <Kpi label="Nuevos contactos" valor={data.kpis.nuevos} acento={C.gold} />
            <Kpi label="Pedidos" valor={data.kpis.totalPedidos} acento={C.sage} />
            <Kpi label="Facturación" valor={fmtMoneda(data.kpis.facturacion)} acento={C.red} chico />
            <Kpi label="Ticket promedio" valor={fmtMoneda(data.kpis.ticket)} chico />
            <Kpi label="Atendido por bot" valor={data.kpis.botPct + "%"} sub={`${data.kpis.agenteCount} por humano`} acento={C.gold} />
          </div>

          {/* Gráfico: actividad temporal */}
          <Panel titulo="Actividad de mensajes y nuevos contactos">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.serie} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: C.muted }} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="in" name="Clientes" stroke={C.red} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="out" name="Respuestas" stroke={C.gold} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="nuevos" name="Nuevos" stroke={C.sage} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 18, marginTop: 18 }}>
            {/* Gráfico: pedidos/facturación por vendedor */}
            <Panel titulo="Rendimiento por vendedor">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.porVendedor} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="vendedor" tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tick={{ fontSize: 11, fill: C.muted }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="contactos" name="Contactos" fill={C.gold} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cerrados" name="Cerrados" fill={C.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Gráfico: embudo de estados */}
            <Panel titulo="Distribución por estado">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.porEstado.filter((e) => e.value > 0)} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name}: ${e.value}`} labelLine={false}
                    style={{ fontSize: 11 }}>
                    {data.porEstado.map((e, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* Tabla vendedores */}
          <Panel titulo="Detalle por vendedor" style={{ marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}`, textAlign: "left", color: C.muted }}>
                  <th style={th}>Vendedor</th><th style={th}>Contactos</th><th style={th}>Cerrados</th>
                  <th style={th}>Pedidos</th><th style={th}>Facturación</th><th style={th}>Mensajes</th>
                </tr>
              </thead>
              <tbody>
                {data.porVendedor.map((v) => (
                  <tr key={v.vendedor} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, fontWeight: 700, color: C.charcoal }}>{v.vendedor}</td>
                    <td style={td}>{v.contactos}</td>
                    <td style={td}>{v.cerrados}</td>
                    <td style={td}>{v.pedidos}</td>
                    <td style={td}>{fmtMoneda(v.facturacion)}</td>
                    <td style={td}>{v.mensajes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div style={{ height: 30 }} />
        </div>
      )}
    </div>
  );
}

function etiquetaPeriodo(p) {
  return { dia: "Hoy", semana: "Últimos 7 días", mes: "Últimos 30 días", anio: "Este año" }[p] || p;
}

function Kpi({ label, valor, sub, acento = C.charcoal, chico }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", borderTop: `3px solid ${acento}` }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: chico ? 22 : 30, fontWeight: 700, color: acento, marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Panel({ titulo, children, style }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", ...style }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, color: C.charcoal, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 14 }}>{titulo}</div>
      {children}
    </div>
  );
}

const btnExp = { background: C.red, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT_BODY };
const th = { padding: "9px 10px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 };
const td = { padding: "9px 10px", color: C.ink };
