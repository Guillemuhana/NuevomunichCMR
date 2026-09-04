import { useState, useEffect } from "react";
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

// ── Marketing, todavía sin habilitar ────────────────────────
// El botón se ve en el menú pero no se puede tocar: el trabajo está hecho
// y sin pagar. Para trabajarlo o mostrarlo se entra una vez con
// ?marketing=on en la dirección; con ?marketing=off se vuelve a bloquear.
//
// Esto DESHABILITA en pantalla, no protege: es un cartel de "no disponible",
// no una medida de seguridad.
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

// ── Clientes potenciales, ya habilitada ─────────────────────────
// Estuvo con candado hasta probar la hoja de ruta; ahora viene abierta
// para el admin. Como cada búsqueda gasta créditos de Google Maps y de
// la IA, queda la salida de emergencia: entrando una vez con
// ?prospectos=off se vuelve a trabar en ese dispositivo, y con
// ?prospectos=on se destraba de nuevo.
const LLAVE_PROSPECTOS = "munich-prospectos-off";

export function prospectosHabilitado() {
  try {
    const p = new URLSearchParams(window.location.search).get("prospectos");
    if (p === "off") localStorage.setItem(LLAVE_PROSPECTOS, "1");
    if (p === "on")  localStorage.removeItem(LLAVE_PROSPECTOS);
    return localStorage.getItem(LLAVE_PROSPECTOS) !== "1";
  } catch {
    return true;
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

export const VENDEDORES = ["Boris", "Cristian", "Luis", "Marcelino", "Mario", "Pablo", "Sandra", "Oficina"];

// Vendedores externos con panel propio
export const VENDEDORES_INFO = [
  { nombre: "Boris Arredondo",   alias: "Boris",     emailPrefix: "boris",     telefono: "5493512168835" },
  { nombre: "Pablo Castillo",    alias: "Pablo",     emailPrefix: "pablo" },
  { nombre: "Marcelino Allende", alias: "Marcelino", emailPrefix: "marcelino" },
  { nombre: "Sandra Scheverman", alias: "Sandra",    emailPrefix: "sandra" },
  { nombre: "Luis Ludueña",      alias: "Luis",      emailPrefix: "luis" },
  { nombre: "Mario Calabria",    alias: "Mario",     emailPrefix: "mario",     telefono: "5493516177741" },
];

// Personal de administración (reciben y ven pedidos de vendedores).
// Editá los nombres acá para que cada cuenta muestre la persona real.
export const ADMINISTRACION_INFO = [
  { nombre: "Administración 1", emailPrefix: "admin1" },
  { nombre: "Administración 2", emailPrefix: "admin2" },
  { nombre: "Administración 3", emailPrefix: "admin3" },
  { nombre: "Administración",   emailPrefix: "admin2026" },
  { nombre: "Administración",   emailPrefix: "administracion" },
];

export function getNombreVisiblePorEmail(userEmail, fallback = "") {
  const email = (userEmail || "").trim();
  const prefix = email.split("@")[0].toLowerCase();
  if (!prefix) return fallback;

  if (prefix === "cristian") return "Cristian";

  const admin = ADMINISTRACION_INFO.find((a) => a.emailPrefix === prefix);
  if (admin?.nombre) return admin.nombre;

  const vendedor = VENDEDORES_INFO.find((v) => v.emailPrefix === prefix);
  if (vendedor?.nombre) return vendedor.nombre;

  const nombreBase = prefix
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

  return fallback || nombreBase;
}

/**
 * ¿Este prefijo de mail es de Administración?
 *
 * Se aceptan los de la lista de arriba y, además, cualquier `adminN`:
 * admin1, admin7, admin10, admin2026… Antes se comparaba contra la lista
 * exacta, así que un mail nuevo como admin10@ caía en "vendedor" sin que
 * nadie lo notara: la persona entraba, no veía ni un chat (porque se le
 * filtran los contactos por un vendedor con su nombre) y parecía un
 * problema de datos.
 */
export function esPrefijoAdministracion(prefix) {
  const p = String(prefix || "").toLowerCase();
  if (ADMINISTRACION_INFO.some((a) => a.emailPrefix === p)) return true;
  if (/^admin\d+$/.test(p)) return true;
  return p === "administracion" || p === "administración";
}

// ─── Mensajería interna: identidad y contactos ──────────────
// Identifica al usuario logueado con una "key" estable para el chat interno.
export function getIdentidadInterna(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  if (prefix === "cristian") return { key: "cristian", nombre: "Cristian" };
  if (esPrefijoAdministracion(prefix)) {
    const admin = ADMINISTRACION_INFO.find((a) => a.emailPrefix === prefix);
    return { key: "administracion", nombre: admin?.nombre || "Administración" };
  }
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
  if (esPrefijoAdministracion(prefix)) return "administracion";
  return "vendedor";
}


// ── Unidades de los artículos de un pedido ──────────────────
// Los pedidos se cargaban siempre por unidad, pero hay clientes que compran
// por peso ("3,5 kg de pepperoni"). El ítem lleva ahora un campo `unidad`;
// los pedidos viejos no lo tienen y se asumen en unidades, así que no hay
// que migrar nada.
export const UNIDADES = [
  { key: "un", label: "un.", nombre: "Unidades" },
  { key: "kg", label: "kg",  nombre: "Kilos" },
];

/** La cantidad lista para mostrar: "12×" o "3,5 kg". */
export function cantidadItem(item) {
  const n = Number(item?.qty ?? 1);
  if (!isFinite(n)) return "1×";
  if (item?.unidad === "kg") {
    // Coma decimal, que es como se escribe acá, y sin ceros de más.
    return `${n.toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`;
  }
  return `${Math.round(n) || 1}×`;
}

/** El artículo entero: "12× Empanadas de carne" o "3,5 kg Pepperoni". */
export function textoItem(item) {
  return `${cantidadItem(item)} ${limpiarPrecios(item?.desc || "")}`.trim();
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
// ── ¿Estamos en un celular? ─────────────────────────────────
// Cada pantalla lo resolvía a su manera y algunas ni se enteraban: la agenda
// del vendedor abría en el teléfono con la columna lateral de escritorio y
// al calendario le quedaban ochenta puntos de ancho. Un solo lugar.
export function useEsMovil(bp = 768) {
  const [movil, setMovil] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const on = () => setMovil(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return movil;
}

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

// ---------- Fechas en hora nuestra ----------
// `created_at` es timestamptz y Supabase lo devuelve en UTC. Cortarle los
// primeros 10 caracteres da la fecha de Londres, no la de acá: todo lo cargado
// después de las 21:00 quedaba con la fecha del día siguiente y un pedido de
// ayer a la noche aparecía como de hoy. Estas dos arman el YYYY-MM-DD con el
// reloj del que está mirando la pantalla.
export function fechaLocalISO(ts) {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function hoyLocalISO() {
  return fechaLocalISO(new Date());
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
