// ============================================================
// Compartir eventos del calendario
// ------------------------------------------------------------
// Tres formas, según lo que soporte el aparato:
//   • compartir nativo (celular): abre el menú de siempre y de ahí
//     va a WhatsApp, mail, lo que sea;
//   • WhatsApp directo: para la web de escritorio, que no tiene
//     menú de compartir;
//   • archivo .ics: para meterlo en Google Calendar o el iPhone.
// ============================================================
// Las etiquetas van copiadas a mano y no importadas del Calendario:
// el Calendario importa este archivo, así que se armaría un círculo.
const ETIQUETA_TIPO = {
  reunion: "Reunión", visita: "Visita", entrega: "Entrega",
  recordatorio: "Recordatorio", otro: "Evento",
};

const dosDigitos = (n) => String(n).padStart(2, "0");

/** "jueves 21 de agosto, 15:30" */
function cuando(ev) {
  const ini = new Date(ev.inicio);
  const fecha = ini.toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long",
  });
  if (ev.todo_el_dia) return `${fecha} (todo el día)`;

  const hora = ini.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (!ev.fin) return `${fecha}, ${hora}`;

  const fin = new Date(ev.fin);
  const horaFin = fin.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fecha}, de ${hora} a ${horaFin}`;
}

/** El texto que se manda por WhatsApp. Con *negritas* al estilo WhatsApp. */
export function textoEvento(ev) {
  const tipo = ETIQUETA_TIPO[ev.tipo] || "Evento";
  const lineas = [
    `*${tipo}: ${ev.titulo}*`,
    `📅 ${cuando(ev)}`,
  ];
  if (ev.lugar) lineas.push(`📍 ${ev.lugar}`);
  if (ev.vendedor) lineas.push(`👤 ${ev.vendedor}`);
  if (ev.descripcion) lineas.push("", ev.descripcion);
  lineas.push("", "_Nuevo Munich_");
  return lineas.join("\n");
}

/** Formato de fecha que pide el estándar .ics: 20260821T153000Z */
function aFechaICS(d) {
  const f = new Date(d);
  return (
    f.getUTCFullYear() +
    dosDigitos(f.getUTCMonth() + 1) +
    dosDigitos(f.getUTCDate()) + "T" +
    dosDigitos(f.getUTCHours()) +
    dosDigitos(f.getUTCMinutes()) +
    dosDigitos(f.getUTCSeconds()) + "Z"
  );
}

/** Los saltos de línea y las comas van escapados en el .ics. */
const escaparICS = (t = "") =>
  String(t).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

/** Arma el contenido de un archivo .ics para un evento. */
export function armarICS(ev) {
  const ini = new Date(ev.inicio);
  const fin = ev.fin ? new Date(ev.fin) : new Date(ini.getTime() + 60 * 60 * 1000);
  const tipo = ETIQUETA_TIPO[ev.tipo] || "Evento";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nuevo Munich CRM//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id || Date.now()}@nuevomunich`,
    `DTSTAMP:${aFechaICS(new Date())}`,
    `DTSTART:${aFechaICS(ini)}`,
    `DTEND:${aFechaICS(fin)}`,
    `SUMMARY:${escaparICS(`${tipo}: ${ev.titulo}`)}`,
    ev.lugar ? `LOCATION:${escaparICS(ev.lugar)}` : null,
    ev.descripcion ? `DESCRIPTION:${escaparICS(ev.descripcion)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

/** Descarga el evento como archivo de calendario. */
export function descargarICS(ev) {
  const blob = new Blob([armarICS(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.titulo || "evento").toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Link de WhatsApp con el evento ya escrito. Si va `telefono`, se lo manda a esa persona. */
export function linkWhatsApp(ev, telefono) {
  const texto = encodeURIComponent(textoEvento(ev));
  const tel = String(telefono || "").replace(/\D/g, "");
  return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

/**
 * Comparte el evento por donde se pueda.
 * @returns {Promise<"nativo"|"whatsapp"|"copiado">} qué terminó pasando
 */
export async function compartirEvento(ev) {
  const texto = textoEvento(ev);

  // 1. Menú de compartir del celular (Android/iOS).
  if (navigator.share) {
    try {
      await navigator.share({ title: ev.titulo, text: texto });
      return "nativo";
    } catch (e) {
      // Si la persona cerró el menú a propósito, no seguimos con el plan B.
      if (e?.name === "AbortError") return "nativo";
    }
  }

  // 2. WhatsApp Web / la app de escritorio.
  const ventana = window.open(linkWhatsApp(ev), "_blank", "noopener,noreferrer");
  if (ventana) return "whatsapp";

  // 3. Último recurso: al portapapeles.
  await navigator.clipboard?.writeText(texto);
  return "copiado";
}
