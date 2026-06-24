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

// Logo oficial de Nuevo Munich
export const LOGO_URL = "/logo.png";

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

export const VENDEDORES = ["Boris", "Cristian", "Luis", "Marcelino", "Pablo", "Sandra"];

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
  { nombre: "Administración",   emailPrefix: "admin2026" },
  { nombre: "Administración",   emailPrefix: "administracion" },
];

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

// Paleta de marca (rojo bávaro / dorado / crema)
export const C = {
  red: "#9c1b1b",
  redDark: "#7a1212",
  gold: "#d4a13a",
  goldSoft: "#e8c878",
  cream: "#f7f1e4",
  paper: "#fffaf0",
  ink: "#241c16",
  charcoal: "#2b2520",
  border: "#e3d8c2",
  muted: "#8f8470",
  sage: "#5d6b3a",
};

export const FONT_DISPLAY = "'Oswald', system-ui, sans-serif";
export const FONT_BODY = "'Libre Franklin', system-ui, sans-serif";

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
