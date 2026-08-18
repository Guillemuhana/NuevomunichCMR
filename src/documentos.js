// ============================================================
// Documentos imprimibles del CRM
// ------------------------------------------------------------
// Cada función arma un PDF con jsPDF y lo devuelve. Quien la llama
// decide si lo manda a la impresora (imprimirDoc) o lo descarga
// (descargarDoc), ambas en ./imprimir.
// ============================================================
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { limpiarPrecios } from "./lib";
import { cabecera, pie, seccion, TABLA } from "./imprimir";

const shortId = (id) => (id || "").slice(0, 6).toUpperCase();

const fFecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";

const ETIQUETA_TIPO = { pedido: "Pedido", visita: "Reporte de visita", reunion: "Reunión" };

// Convierte "2026-08-18" o un ISO completo a fecha local sin corrimiento de día.
function aFechaLocal(v) {
  if (!v) return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
}

function esMismoDia(a, b) {
  const x = aFechaLocal(a), y = aFechaLocal(b);
  return !!x && !!y && x.toDateString() === y.toDateString();
}

// Bloque de datos en dos columnas (etiqueta: valor). Devuelve la Y siguiente.
function campos(doc, pares, y) {
  const visibles = pares.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  visibles.forEach(([etiqueta, valor], i) => {
    const col = i % 2;
    const x = 14 + col * 96;
    if (col === 0 && i > 0) y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(130, 122, 105);
    doc.text(String(etiqueta).toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(40, 30, 20);
    doc.text(doc.splitTextToSize(String(valor), 90)[0] || "", x, y + 5);
  });
  return y + (visibles.length ? 14 : 0);
}

// ============================================================
// 1. REPORTE DIARIO DEL VENDEDOR
// ============================================================
/**
 * Resumen de la jornada de un vendedor.
 * @param {string} vendedor  alias del vendedor
 * @param {object[]} entradas  filas de `pedidos` del vendedor
 * @param {(raw:any)=>object} parse  parser del campo detalle
 * @param {Record<string,object>} contactos  mapa id -> contacto
 * @param {Date|string} dia  jornada a reportar (por defecto hoy)
 */
export function docReporteDiario(vendedor, entradas, parse, contactos = {}, dia = new Date()) {
  const doc = new jsPDF({ format: "a4" });
  const fecha = aFechaLocal(dia) || new Date();
  const fechaLarga = fecha.toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  let y = cabecera(doc, "Reporte diario", `${vendedor} · ${fechaLarga}`);

  // Cargadas en el día
  const delDia = entradas.filter((e) => esMismoDia(e.created_at, fecha));
  // Con entrega/visita agendada para el día, sin importar cuándo se cargaron
  const agendadas = entradas.filter((e) => {
    const d = parse(e.detalle);
    return esMismoDia(d.fecha_entrega || d.fecha_visita, fecha);
  });

  const cuenta = (arr, tipo) => arr.filter((e) => (parse(e.detalle).tipo || "pedido") === tipo).length;

  y = seccion(doc, "Resumen", y);
  y = campos(doc, [
    ["Entradas cargadas hoy", String(delDia.length)],
    ["Agendado para hoy", String(agendadas.length)],
    ["Pedidos", String(cuenta(delDia, "pedido"))],
    ["Visitas", String(cuenta(delDia, "visita"))],
    ["Reuniones", String(cuenta(delDia, "reunion"))],
    ["Entregados", String(delDia.filter((e) => e.estado === "entregado").length)],
  ], y);

  const fila = (e) => {
    const d = parse(e.detalle);
    const c = contactos[e.contacto_id] || {};
    const items = (d.items || []).filter((i) => i.desc?.trim());
    return [
      fHora(e.created_at),
      ETIQUETA_TIPO[d.tipo || "pedido"] || "Pedido",
      c.nombre || d.clienteNombre || "—",
      items.length
        ? items.map((i) => `${i.qty || 1}x ${limpiarPrecios(i.desc)}`).join(", ").slice(0, 70)
        : (d.observacion || "—").slice(0, 70),
      e.estado || "—",
    ];
  };

  if (delDia.length) {
    y = seccion(doc, `Cargado hoy (${delDia.length})`, y);
    autoTable(doc, {
      ...TABLA,
      startY: y,
      head: [["Hora", "Tipo", "Cliente", "Detalle", "Estado"]],
      body: delDia.map(fila),
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 28 }, 2: { cellWidth: 42 }, 4: { cellWidth: 24 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (agendadas.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = seccion(doc, `Agendado para hoy (${agendadas.length})`, y);
    autoTable(doc, {
      ...TABLA,
      startY: y,
      headStyles: { ...TABLA.headStyles, fillColor: [212, 161, 58], textColor: [40, 30, 20] },
      head: [["Cliente", "Teléfono", "Dirección", "Entrega", "Estado"]],
      body: agendadas.map((e) => {
        const d = parse(e.detalle);
        const c = contactos[e.contacto_id] || {};
        return [
          c.nombre || d.clienteNombre || "—",
          c.telefono || d.clienteTel || "—",
          (d.direccion || c.direccion || "—").slice(0, 40),
          d.entrega || "—",
          e.estado || "—",
        ];
      }),
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (!delDia.length && !agendadas.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(130, 122, 105);
    doc.text("Sin movimientos registrados en el día.", 14, y + 4);
    y += 16;
  }

  // Espacio para firma, que es para lo que se imprime en papel
  if (y > 250) { doc.addPage(); y = 30; }
  y = Math.max(y, 235);
  doc.setDrawColor(190, 182, 168);
  doc.line(20, y + 16, 90, y + 16);
  doc.line(120, y + 16, 190, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(130, 122, 105);
  doc.text("Firma del vendedor", 20, y + 21);
  doc.text("Recibido por", 120, y + 21);

  pie(doc);
  return doc;
}

// ============================================================
// 2. FICHA DE VISITA / REUNIÓN
// ============================================================
/**
 * Ficha de una visita o reunión. Es el documento que antes salía con
 * el formato de un pedido, que no correspondía.
 */
export function docFichaVisita(entrada, contacto, parse) {
  const doc = new jsPDF({ format: "a4" });
  const d = parse(entrada.detalle);
  const c = contacto || {};
  const tipo = ETIQUETA_TIPO[d.tipo] || "Reporte de visita";

  let y = cabecera(
    doc,
    tipo,
    `N° ${shortId(entrada.id)} · ${fFecha(entrada.created_at)} ${fHora(entrada.created_at)}`
  );

  y = seccion(doc, "Cliente", y);
  y = campos(doc, [
    ["Nombre", c.nombre || d.clienteNombre || "—"],
    ["Empresa", c.empresa],
    ["Teléfono", c.telefono || d.clienteTel],
    ["Email", c.email],
    ["Dirección", d.direccion || c.direccion],
    ["Vendedor", entrada.vendedor],
  ], y);

  y = seccion(doc, "Datos de la visita", y);
  y = campos(doc, [
    ["Tipo", tipo],
    ["Estado", entrada.estado],
    ["Fecha agendada", (d.fecha_visita || d.fecha_entrega) ? fFecha(d.fecha_visita || d.fecha_entrega) : null],
    ["Modalidad", d.entrega],
  ], y);

  // La observación es el corazón del reporte de visita
  const texto = [d.observacion, d.detalle_extra].filter(Boolean).join("\n\n");
  if (texto.trim()) {
    y = seccion(doc, "Observaciones", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(40, 30, 20);
    const lineas = doc.splitTextToSize(limpiarPrecios(texto), 182);
    lineas.forEach((linea) => {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.text(linea, 14, y);
      y += 5.5;
    });
    y += 8;
  }

  const items = (d.items || []).filter((i) => i.desc?.trim());
  if (items.length) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = seccion(doc, "Productos conversados", y);
    autoTable(doc, {
      ...TABLA,
      startY: y,
      head: [["Cant.", "Descripción"]],
      body: items.map((i) => [String(i.qty || 1), limpiarPrecios(i.desc || "")]),
      columnStyles: { 0: { cellWidth: 18, halign: "center" }, 1: { cellWidth: 164 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // Renglones para escribir a mano lo que surja en la visita
  if (y < 250) {
    y = seccion(doc, "Notas de la visita", y);
    doc.setDrawColor(220, 214, 202);
    for (let i = 0; i < 5 && y < 272; i++) {
      doc.line(14, y, 196, y);
      y += 8;
    }
  }

  pie(doc);
  return doc;
}

// ============================================================
// 3. HOJA DE RUTA — ENTREGAS DEL DÍA
// ============================================================
/**
 * Listado de entregas agendadas para un día, en horizontal, pensado
 * para que lo lleve en papel quien reparte.
 */
export function docHojaRuta(pedidos, contactos, parse, dia = new Date()) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  const fecha = aFechaLocal(dia) || new Date();
  const fechaLarga = fecha.toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  let y = cabecera(doc, "Hoja de ruta — Entregas", fechaLarga, "l");

  const delDia = pedidos
    .filter((p) => {
      const d = parse(p.detalle);
      return esMismoDia(d.fecha_entrega, fecha) && p.estado !== "cancelado";
    })
    .sort((a, b) => {
      const da = parse(a.detalle), db = parse(b.detalle);
      return (da.direccion || "").localeCompare(db.direccion || "");
    });

  if (!delDia.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(130, 122, 105);
    doc.text("No hay entregas agendadas para este día.", 14, y + 6);
    pie(doc, "l");
    return doc;
  }

  autoTable(doc, {
    ...TABLA,
    startY: y,
    head: [["", "#", "Cliente", "Teléfono", "Dirección", "Artículos", "Pago", "Vendedor"]],
    body: delDia.map((p, i) => {
      const d = parse(p.detalle);
      const c = contactos[p.contacto_id] || {};
      const items = (d.items || []).filter((it) => it.desc?.trim());
      return [
        "",                       // casilla para tildar al entregar
        String(i + 1),
        c.nombre || d.clienteNombre || "—",
        c.telefono || d.clienteTel || "—",
        d.direccion || c.direccion || "—",
        items.map((it) => `${it.qty || 1}x ${limpiarPrecios(it.desc)}`).join(", ") || "—",
        d.pago || "—",
        p.vendedor || "—",
      ];
    }),
    bodyStyles: { ...TABLA.bodyStyles, minCellHeight: 11 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 45 },
      3: { cellWidth: 30 },
      4: { cellWidth: 62 },
      6: { cellWidth: 26 },
      7: { cellWidth: 24 },
    },
    // Cuadradito para tildar cada entrega al hacerla
    didDrawCell: (dc) => {
      if (dc.section === "body" && dc.column.index === 0) {
        doc.setDrawColor(120, 112, 98);
        doc.setLineWidth(0.4);
        doc.rect(dc.cell.x + 2.5, dc.cell.y + dc.cell.height / 2 - 2.5, 5, 5);
      }
    },
  });

  const y2 = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 30, 20);
  doc.text(`Total de entregas: ${delDia.length}`, 14, y2);

  pie(doc, "l");
  return doc;
}

// ============================================================
// 4. VENTAS POR RANGO DE FECHAS
// ============================================================
/**
 * Listado de ventas/pedidos entre dos fechas, con el resumen por
 * estado y por vendedor. Es el reporte que se lleva a papel.
 *
 * @param {object[]} pedidos
 * @param {Record<string,object>} contactos  mapa id -> contacto
 * @param {(raw:any)=>object} parse
 * @param {string} desde  "AAAA-MM-DD"
 * @param {string} hasta  "AAAA-MM-DD"
 * @param {Record<string,{label:string}>} estados  mapa de estados a etiqueta
 */
export function docVentasRango(pedidos, contactos, parse, desde, hasta, estados = {}) {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });

  const ini = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T23:59:59`);
  const etiquetaEstado = (e) => estados[e]?.label || e || "—";

  const enRango = pedidos
    .filter((p) => {
      const f = new Date(p.created_at);
      return f >= ini && f <= fin;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let y = cabecera(
    doc,
    "Ventas por período",
    `${fFecha(ini)} al ${fFecha(fin)} · ${enRango.length} ${enRango.length === 1 ? "venta" : "ventas"}`,
    "l"
  );

  if (!enRango.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(130, 122, 105);
    doc.text("No hay ventas registradas en este período.", 14, y + 6);
    pie(doc, "l");
    return doc;
  }

  // ── Resumen por estado y por vendedor ──
  const porEstado = {};
  const porVendedor = {};
  enRango.forEach((p) => {
    const e = etiquetaEstado(p.estado);
    porEstado[e] = (porEstado[e] || 0) + 1;
    const v = p.vendedor || "Sin asignar";
    porVendedor[v] = (porVendedor[v] || 0) + 1;
  });

  y = seccion(doc, "Resumen", y);
  autoTable(doc, {
    ...TABLA,
    startY: y,
    head: [["Por estado", "Cant.", "Por vendedor", "Cant."]],
    body: (() => {
      const est = Object.entries(porEstado).sort((a, b) => b[1] - a[1]);
      const ven = Object.entries(porVendedor).sort((a, b) => b[1] - a[1]);
      const filas = [];
      for (let i = 0; i < Math.max(est.length, ven.length); i++) {
        filas.push([
          est[i]?.[0] ?? "", est[i] ? String(est[i][1]) : "",
          ven[i]?.[0] ?? "", ven[i] ? String(ven[i][1]) : "",
        ]);
      }
      return filas;
    })(),
    headStyles: { ...TABLA.headStyles, fillColor: [212, 161, 58], textColor: [40, 30, 20] },
    columnStyles: {
      0: { cellWidth: 55 }, 1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 55 }, 3: { cellWidth: 20, halign: "center" },
    },
  });
  y = doc.lastAutoTable.finalY + 12;

  // ── Detalle ──
  y = seccion(doc, "Detalle de ventas", y);
  autoTable(doc, {
    ...TABLA,
    startY: y,
    head: [["Fecha", "N°", "Cliente", "Teléfono", "Artículos", "Vendedor", "Entrega", "Pago", "Estado"]],
    body: enRango.map((p) => {
      const d = parse(p.detalle);
      const c = contactos[p.contacto_id] || {};
      const items = (d.items || []).filter((i) => i.desc?.trim());
      return [
        fFecha(p.created_at),
        shortId(p.id),
        c.nombre || d.clienteNombre || "—",
        c.telefono || d.clienteTel || "—",
        items.map((i) => `${i.qty || 1}x ${limpiarPrecios(i.desc)}`).join(", ") || "—",
        p.vendedor || "—",
        d.fecha_entrega ? fFecha(d.fecha_entrega) : (d.entrega || "—"),
        d.pago || "—",
        etiquetaEstado(p.estado),
      ];
    }),
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16 },
      2: { cellWidth: 40 },
      3: { cellWidth: 27 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 23 },
    },
    bodyStyles: { ...TABLA.bodyStyles, fontSize: 8.5 },
  });

  const y2 = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(40, 30, 20);
  doc.text(`Total del período: ${enRango.length} ventas`, 14, y2);

  pie(doc, "l");
  return doc;
}

// ============================================================
// 5. FICHA DE CONTACTO
// ============================================================
/**
 * Ficha de un cliente con sus datos y sus últimos pedidos.
 */
export function docFichaContacto(contacto, pedidos = [], parse) {
  const doc = new jsPDF({ format: "a4" });
  const c = contacto || {};

  let y = cabecera(doc, "Ficha de cliente", c.nombre || c.telefono || "—");

  y = seccion(doc, "Datos", y);
  y = campos(doc, [
    ["Nombre", c.nombre],
    ["Teléfono", c.telefono],
    ["Empresa", c.empresa],
    ["Email", c.email],
    ["Dirección", c.direccion],
    ["Vendedor asignado", c.vendedor],
    ["Estado", c.estado],
    ["Cliente desde", c.created_at ? fFecha(c.created_at) : null],
  ], y);

  if (c.nota_seguimiento || c.seguimiento_at) {
    y = seccion(doc, "Seguimiento", y);
    y = campos(doc, [
      ["Próximo contacto", c.seguimiento_at ? fFecha(c.seguimiento_at) : null],
      ["Nota", c.nota_seguimiento],
    ], y);
  }

  const suyos = pedidos.filter((p) => p.contacto_id === c.id);
  if (suyos.length) {
    y = seccion(doc, `Historial de pedidos (${suyos.length})`, y);
    autoTable(doc, {
      ...TABLA,
      startY: y,
      head: [["Fecha", "N°", "Artículos", "Estado", "Vendedor"]],
      body: suyos.slice(0, 25).map((p) => {
        const d = parse(p.detalle);
        const items = (d.items || []).filter((i) => i.desc?.trim());
        return [
          fFecha(p.created_at),
          shortId(p.id),
          items.map((i) => `${i.qty || 1}x ${limpiarPrecios(i.desc)}`).join(", ").slice(0, 60) || "—",
          p.estado || "—",
          p.vendedor || "—",
        ];
      }),
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 3: { cellWidth: 24 }, 4: { cellWidth: 26 } },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  if (y < 250) {
    y = seccion(doc, "Notas", y);
    doc.setDrawColor(220, 214, 202);
    for (let i = 0; i < 6 && y < 272; i++) {
      doc.line(14, y, 196, y);
      y += 8;
    }
  }

  pie(doc);
  return doc;
}
