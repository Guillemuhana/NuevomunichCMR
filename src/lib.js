import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "munich-crm-session",
    },
  }
);

export const N8N_SEND_WEBHOOK = import.meta.env.VITE_N8N_SEND_WEBHOOK;
// Webhook que lista las plantillas aprobadas en Meta (workflow MunichCRM-Plantillas).
export const N8N_PLANTILLAS_WEBHOOK = import.meta.env.VITE_N8N_PLANTILLAS_WEBHOOK;

// ── Marketing todavía sin estrenar ──────────────────────────
// La pestaña se ve, pero muestra "Próximamente" hasta que el trabajo esté
// aprobado. Para destrabarla en una máquina se entra una vez con
// ?marketing=on en la dirección; con ?marketing=off se vuelve a tapar.
//
// Esto ESCONDE, no protege: es para no mostrar algo a medio terminar, no
// una medida de seguridad. Quien conozca el truco entra igual.
const LLAVE_MARKETING = "munich-marketing-on";

export function marketingHabilitado() {
  try {
    const p = new URLSearchParams(window.location.search).get("marketing");
    if (p === "on")  localStorage.setItem(LLAVE_MARKETING, "1");
    if (p === "off") localStorage.removeItem(LLAVE_MARKETING);
    return localStorage.getItem(LLAVE_MARKETING) === "1";
  } catch {
    return false;
  }
}

// ── Armado del mensaje para la API de Meta ──────────────────
/**
 * Devuelve el cuerpo exacto que espera WhatsApp Cloud API.
 *
 * Antes esto se armaba con una expresión de JavaScript metida dentro de un
 * campo de n8n: mil caracteres en una sola línea, imposibles de pegar sin
 * romper algo y sin forma de probarlos. Ahora se arma acá, donde se puede
 * leer y testear, y n8n sólo reenvía lo que le llega.
 *
 * @param {object} op
 *   telefono                     a quién (se le sacan los no-dígitos)
 *   mensaje                      texto, o epígrafe si va con archivo
 *   mediaUrl/mediaTipo/mediaNombre   para mandar imagen, video, audio o archivo
 *   plantilla/idioma/parametros  para mandar una plantilla aprobada
 *   headerUrl/headerTipo         archivo de la cabecera de la plantilla
 */
export function construirMensajeMeta(op = {}) {
  const to = String(op.telefono || "").replace(/\D/g, "");
  const base = { messaging_product: "whatsapp", to };

  // 1. Plantilla aprobada (lo único que Meta deja usar pasadas las 24 horas)
  if (op.plantilla) {
    const components = [];

    if (op.headerUrl) {
      const t = ["image", "video", "document"].includes(String(op.headerTipo || "").toLowerCase())
        ? String(op.headerTipo).toLowerCase()
        : "image";
      components.push({ type: "header", parameters: [{ type: t, [t]: { link: op.headerUrl } }] });
    }

    const ps = (op.parametros || []).map((p) => ({ type: "text", text: String(p) }));
    if (ps.length) components.push({ type: "body", parameters: ps });

    return {
      ...base,
      type: "template",
      template: { name: op.plantilla, language: { code: op.idioma || "es_AR" }, components },
    };
  }

  // 2. Con archivo
  if (op.mediaUrl) {
    const t = ["image", "video", "audio", "document"].includes(op.mediaTipo) ? op.mediaTipo : "document";
    const media = { link: op.mediaUrl };
    if (t === "document") media.filename = op.mediaNombre || "archivo";
    // El audio de WhatsApp no admite epígrafe.
    if (op.mensaje && t !== "audio") media.caption = op.mensaje;
    return { ...base, type: t, [t]: media };
  }

  // 3. Texto suelto
  return { ...base, type: "text", text: { body: op.mensaje || "" } };
}


// Logo oficial de Nuevo Munich
export const LOGO_URL = "/logo.png";
// Video de marca que anima la cabecera del rail (cae al logo si falla)
export const LOGO_VIDEO_URL = "/cmrvideo.mp4";

// Elimina del texto cualquier referencia a precios, montos, símbolos $ y pesos.
// En este CRM no se manejan precios, así que se ocultan en mensajes y pedidos.
export function limpiarPrecios(txt) {
  if (!txt || typeof txt !== "string") return txt;
  return txt
    // Montos con símbolo: $1500, $ 1.500,00, AR$ 2000, ARS 1500, USD 10
    .replace(/(?:ar|u\$?s|usd)?\s*\$\s?\d[\d.,]*/gi, "")
    .replace(/\b(?:ars|usd)\s*\d[\d.,]*/gi, "")
    .replace(/\$/g, "")
    // Etiquetas precio/monto/total/importe/subtotal con o sin valor
    .replace(/\b(precios?|montos?|importes?|sub\s*totales?|totales?)\b\s*:?\s*\$?\s*\d?[\d.,]*/gi, "")
    // Cantidades en pesos: "1.500 pesos"
    .replace(/\d[\d.,]*\s*pesos?\b/gi, "")
    .replace(/\bpesos?\b/gi, "")
    // Limpieza de residuos (espacios dobles, líneas que quedaron con solo signos)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[\s:;,.\-•]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const VENDEDORES = ["Boris", "Cristian", "Luis", "Marcelino", "Pablo", "Sandra", "Oficina"];

// Vendedores externos con panel propio
export const VENDEDORES_INFO = [
  { nombre: "Boris Arredondo",   alias: "Boris",     emailPrefix: "boris",     telefono: "5493512168835" },
  { nombre: "Pablo Castillo",    alias: "Pablo",     emailPrefix: "pablo" },
  { nombre: "Marcelino Allende", alias: "Marcelino", emailPrefix: "marcelino" },
  { nombre: "Sandra Scheverman", alias: "Sandra",    emailPrefix: "sandra" },
  { nombre: "Luis Ludueña",      alias: "Luis",      emailPrefix: "luis" },
];

// Personal de administración (reciben y ven pedidos de vendedores)
export const ADMINISTRACION_INFO = [
  { nombre: "Administración 1", emailPrefix: "admin1" },
  { nombre: "Administración 2", emailPrefix: "admin2" },
  { nombre: "Administración 3", emailPrefix: "admin3" },
  { nombre: "Administración",   emailPrefix: "admin2026" },
  { nombre: "Administración",   emailPrefix: "administracion" },
];

// ─── Mensajería interna: identidad y contactos ──────────────
// Identifica al usuario logueado con una "key" estable para el chat interno.
export function getIdentidadInterna(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  if (prefix === "cristian") return { key: "cristian", nombre: "Cristian" };
  if (ADMINISTRACION_INFO.some(a => a.emailPrefix === prefix)) return { key: "administracion", nombre: "Administración" };
  const v = VENDEDORES_INFO.find(v => v.emailPrefix === prefix);
  if (v) return { key: v.emailPrefix, nombre: v.alias || v.nombre };
  return { key: prefix, nombre: prefix };
}

// Lista de usuarios a los que se les puede escribir (todos menos uno mismo).
export function getContactosInternos(selfKey) {
  const todos = [
    { key: "cristian", nombre: "Cristian (Admin)" },
    { key: "administracion", nombre: "Administración" },
    ...VENDEDORES_INFO.map(v => ({ key: v.emailPrefix, nombre: v.nombre })),
  ];
  return todos.filter(c => c.key !== selfKey);
}

// ─── Roles de usuario ───────────────────────────────────────
// "cristian" → admin; vendedores conocidos → vendedor_panel
// personal admin → administracion; resto → vendedor
export function getRol(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  if (prefix === "cristian") return "admin";
  if (VENDEDORES_INFO.some(v => v.emailPrefix === prefix)) return "vendedor_panel";
  if (ADMINISTRACION_INFO.some(a => a.emailPrefix === prefix)) return "administracion";
  return "vendedor";
}

// ─── Estados del pipeline CRM ───────────────────────────────
export const ESTADOS = {
  // Estados activos del pipeline
  nuevo:       { label: "Nuevo",        color: "#8a6a1e", bg: "#f5e6c8" },
  contactado:  { label: "Contactado",   color: "#1D4ED8", bg: "#DBEAFE" },
  interesado:  { label: "Interesado",   color: "#7C3AED", bg: "#EDE9FE" },
  pendiente:   { label: "Pendiente",    color: "#92400E", bg: "#FEF3C7" },
  vendido:     { label: "Vendido",      color: "#15803D", bg: "#DCFCE7" },
  finalizado:  { label: "Finalizado",   color: "#374151", bg: "#E2E8F0" },
  // Legacy — backward compat para datos existentes
  perdido:     { label: "Perdido",      color: "#7a3a2a", bg: "#ecd5cf" },
  en_conversacion: { label: "En conversación", color: "#7a1212", bg: "#e7d4d4" },
  pedido:      { label: "Pedido",       color: "#46571f", bg: "#dde7cf" },
  cerrado:     { label: "Cerrado",      color: "#4a4a4a", bg: "#e3e3e3" },
};

// Estados mostrados en dropdowns (sin estados legacy ni perdido)
export const ESTADOS_ACTIVOS = ["nuevo", "contactado", "interesado", "pendiente", "vendido", "finalizado"];

// Paleta de marca — rojo Munich como acento, base sobria
export const C = {
  red: "#A81F1F",
  redDark: "#7F1414",
  redSoft: "#FDF2F2",
  gold: "#C08A2E",
  goldSoft: "#F3E7CC",
  cream: "#FAF8F4",
  paper: "#FFFFFF",
  ink: "#101828",
  charcoal: "#1D2939",
  border: "#E6E9EF",
  muted: "#667085",
  sage: "#5D6B3A",
};

// ── Paleta neutra compartida (tema claro) ───────────────────
export const L = {
  bg:     "#F7F8FA",
  white:  "#FFFFFF",
  border: "#E6E9EF",
  text:   "#101828",
  muted:  "#667085",
  light:  "#98A2B3",
  soft:   "#F4F6F8",
  hover:  "#FBF4F4",
  active: "#FDF2F2",
};

// ── Tokens de forma y profundidad ───────────────────────────
export const R = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

export const SH = {
  xs: "0 1px 2px rgba(16,24,40,.05)",
  sm: "0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)",
  md: "0 4px 14px rgba(16,24,40,.07)",
  lg: "0 12px 32px rgba(16,24,40,.12)",
  xl: "0 24px 64px rgba(16,24,40,.16)",
};

export const FONT_DISPLAY = "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif";
export const FONT_BODY = "'Inter Variable', system-ui, -apple-system, sans-serif";

// ---------- Utilidades de fecha ----------
export function rangoFechas(periodo) {
  const ahora = new Date();
  const fin = new Date(ahora);
  const inicio = new Date(ahora);
  if (periodo === "dia") {
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === "semana") {
    inicio.setDate(inicio.getDate() - 6);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === "mes") {
    inicio.setDate(inicio.getDate() - 29);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === "anio") {
    inicio.setMonth(0, 1);
    inicio.setHours(0, 0, 0, 0);
  }
  return { inicio, fin };
}

export function fmtFecha(d) {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
export function fmtFechaLarga(d) {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}
export function fmtMoneda(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
}

// ---------- Exportación CSV ----------
export function exportarCSV(filas, nombreArchivo) {
  if (!filas || filas.length === 0) return;
  const cols = Object.keys(filas[0]);
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(";"),
    ...filas.map((f) => cols.map((c) => escape(f[c])).join(";")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  descargar(blob, nombreArchivo.endsWith(".csv") ? nombreArchivo : nombreArchivo + ".csv");
}

export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Alertas ----------
// Devuelve lista de alertas según reglas de negocio.
export function calcularAlertas(contactos) {
  const ahora = Date.now();
  const HORA = 3600 * 1000;
  const alertas = [];
  for (const c of contactos) {
    const nombre = c.nombre || c.telefono;
    // 1) Cliente escribió y nadie respondió hace > 1h (y el bot está pausado)
    if (
      !c.bot_activo &&
      c.ultimo_in_at &&
      (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at)) &&
      ahora - new Date(c.ultimo_in_at).getTime() > HORA
    ) {
      alertas.push({
        id: `resp-${c.id}`,
        tipo: "sin_respuesta",
        contacto: c,
        texto: `${nombre} espera respuesta hace más de 1 h`,
        prioridad: 1,
      });
    }
    // 2) Lead nuevo sin vendedor asignado hace > 2h — solo si tuvo actividad WhatsApp
    if (c.estado === "nuevo" && !c.vendedor && ahora - new Date(c.created_at).getTime() > 2 * HORA
        && (c.ultimo_in_at || c.ultimo_out_at)) {
      alertas.push({
        id: `lead-${c.id}`,
        tipo: "lead_sin_asignar",
        contacto: c,
        texto: `Lead nuevo sin asignar: ${nombre}`,
        prioridad: 2,
      });
    }
    // 3) Seguimiento vencido
    if (c.seguimiento_at && new Date(c.seguimiento_at).getTime() <= ahora) {
      alertas.push({
        id: `seg-${c.id}`,
        tipo: "seguimiento",
        contacto: c,
        texto: `Seguimiento pendiente: ${nombre}${c.nota_seguimiento ? " — " + c.nota_seguimiento : ""}`,
        prioridad: 1,
      });
    }
  }
  return alertas.sort((a, b) => a.prioridad - b.prioridad);
}
