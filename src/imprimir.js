// ============================================================
// Impresión de documentos PDF
// ------------------------------------------------------------
// Toda la app genera los PDF con jsPDF. Este módulo agrega la
// posibilidad de mandarlos directo al diálogo de impresión, en vez
// de solamente descargar el archivo.
// ============================================================

const MARCA = { rojo: [156, 27, 27], oro: [212, 161, 58], tinta: [40, 30, 20], gris: [140, 132, 114] };

// En el APK de Android la impresión desde la webview no está disponible,
// así que ahí siempre cae en descargar el archivo.
function esNativo() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

/**
 * Manda un documento jsPDF al diálogo de impresión del sistema.
 * Si algo falla (o estamos en el APK), descarga el PDF como antes.
 *
 * @param {import("jspdf").jsPDF} doc  documento ya armado
 * @param {string} nombreArchivo       nombre para el caso de descarga
 */
export function imprimirDoc(doc, nombreArchivo) {
  if (esNativo()) return descargarDoc(doc, nombreArchivo);

  try {
    // autoPrint hace que el visor abra el diálogo de impresión solo.
    doc.autoPrint();
    const url = doc.output("bloburl");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // No usamos display:none — algunos navegadores no imprimen iframes ocultos así.
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
    iframe.src = url;

    let listo = false;
    iframe.onload = () => {
      listo = true;
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        // El visor de PDF ya dispara la impresión por su cuenta (autoPrint).
      }
      // Se limpia después de un rato: si se saca antes, el diálogo se cierra.
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };

    document.body.appendChild(iframe);

    // Red de seguridad: si el iframe nunca cargó, ofrecemos la descarga.
    setTimeout(() => {
      if (!listo) {
        iframe.remove();
        descargarDoc(doc, nombreArchivo);
      }
    }, 4000);
  } catch {
    descargarDoc(doc, nombreArchivo);
  }
}

/** Descarga el PDF como archivo (comportamiento clásico). */
export function descargarDoc(doc, nombreArchivo) {
  doc.save(nombreArchivo.endsWith(".pdf") ? nombreArchivo : `${nombreArchivo}.pdf`);
}

// ── Piezas visuales compartidas por todos los documentos ────────

/**
 * Cabecera roja con la marca. Devuelve la coordenada Y donde seguir.
 * @param {"p"|"l"} orientacion  vertical u horizontal
 */
export function cabecera(doc, titulo, subtitulo, orientacion = "p") {
  const w = orientacion === "l" ? 297 : 210;
  doc.setFillColor(...MARCA.rojo);
  doc.rect(0, 0, w, 32, "F");
  doc.setFillColor(...MARCA.oro);
  doc.rect(0, 29, w, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(titulo, 14, 15);

  if (subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(subtitulo, 14, 24);
  }

  doc.setTextColor(...MARCA.tinta);
  return 44;
}

/** Pie de página con la fecha de generación, en todas las hojas. */
export function pie(doc, orientacion = "p") {
  const w = orientacion === "l" ? 297 : 210;
  const h = orientacion === "l" ? 210 : 297;
  const total = doc.internal.getNumberOfPages();

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MARCA.gris);
    doc.text(
      `Nuevo Munich · Generado el ${new Date().toLocaleString("es-AR")}`,
      14, h - 8
    );
    doc.text(`Página ${i} de ${total}`, w - 14, h - 8, { align: "right" });
  }
}

/** Título de sección con línea debajo. Devuelve la Y siguiente. */
export function seccion(doc, texto, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...MARCA.rojo);
  doc.text(texto, 14, y);
  doc.setDrawColor(230, 225, 215);
  doc.line(14, y + 2, doc.internal.pageSize.width - 14, y + 2);
  doc.setTextColor(...MARCA.tinta);
  return y + 9;
}

/** Estilos por defecto de las tablas, para que todos los PDF se vean igual. */
export const TABLA = {
  headStyles: { fillColor: MARCA.rojo, fontSize: 9.5, fontStyle: "bold" },
  bodyStyles: { fontSize: 9.5, cellPadding: 3 },
  alternateRowStyles: { fillColor: [252, 248, 240] },
  margin: { left: 14, right: 14 },
};
