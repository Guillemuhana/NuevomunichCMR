// ============================================================
// Marketing — la parte que no es pantalla
// ------------------------------------------------------------
// Armar la audiencia, resolver las variables de la plantilla y
// mandar cada mensaje. Vive aparte de Marketing.jsx para poder
// probarlo sin levantar React.
// ============================================================
import { supabase, N8N_SEND_WEBHOOK, N8N_PLANTILLAS_WEBHOOK } from "./lib";

// ── Variables de la plantilla ───────────────────────────────
// Campos del contacto que se pueden meter dentro de una plantilla.
export const CAMPOS_CONTACTO = [
  { key: "nombre",        label: "Nombre del cliente" },
  { key: "primer_nombre", label: "Primer nombre" },
  { key: "empresa",       label: "Empresa" },
  { key: "vendedor",      label: "Vendedor asignado" },
  { key: "telefono",      label: "Teléfono" },
];

/**
 * Saca de un contacto el texto de una variable.
 * Nunca devuelve vacío: Meta rechaza el envío si un parámetro viene en blanco.
 */
export function valorDeCampo(contacto, campo, respaldo = "cliente") {
  const c = contacto || {};
  const limpio = (v) => String(v ?? "").trim();
  switch (campo) {
    case "primer_nombre": {
      const n = limpio(c.nombre).split(/\s+/)[0];
      return n || respaldo;
    }
    case "empresa":  return limpio(c.empresa)  || respaldo;
    case "vendedor": return limpio(c.vendedor) || respaldo;
    case "telefono": return limpio(c.telefono) || respaldo;
    case "nombre":
    default:         return limpio(c.nombre)   || respaldo;
  }
}

/**
 * Resuelve todas las variables de una campaña para un contacto.
 * @param {object[]} parametros  [{ num, tipo: "campo"|"fijo", valor }]
 * @returns {string[]} los textos en orden: [{{1}}, {{2}}, …]
 */
export function resolverParametros(parametros, contacto) {
  return [...(parametros || [])]
    .sort((a, b) => a.num - b.num)
    .map((p) => {
      const v = p.tipo === "campo"
        ? valorDeCampo(contacto, p.valor)
        : String(p.valor ?? "").trim();
      // Meta también rechaza saltos de línea y tabs dentro de un parámetro.
      return (v || "—").replace(/[\n\t]+/g, " ").slice(0, 300);
    });
}

/** Reemplaza {{1}}, {{2}}… en el cuerpo, para mostrar la vista previa. */
export function vistaPrevia(cuerpo, valores) {
  return String(cuerpo || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => {
    const v = valores[Number(n) - 1];
    return v === undefined ? m : v;
  });
}

/** Cuántas variables usa realmente el cuerpo de la plantilla. */
export function variablesDelCuerpo(cuerpo) {
  const nums = [...String(cuerpo || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  return [...new Set(nums)].sort((a, b) => a - b);
}

/**
 * Huecos con nombre, tipo {{nombre_cliente}}, que Meta permite en las
 * plantillas nuevas. Nosotros mandamos los parámetros por posición, así que
 * una plantilla así no se puede usar todavía: conviene avisarlo en pantalla
 * en vez de dejar que el envío falle contacto por contacto.
 */
export function variablesConNombre(cuerpo) {
  const nombres = [...String(cuerpo || "").matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(nombres)];
}

// ── Sincronizar con Meta ────────────────────────────────────
/**
 * Trae las plantillas de la cuenta de WhatsApp Business y las guarda en el CRM.
 *
 * La consulta pasa por n8n a propósito: el token de Meta no puede viajar al
 * navegador. Ver el workflow MunichCRM-Plantillas.
 *
 * @returns {Promise<{total:number, aprobadas:number, otras:number, nombres:string[]}>}
 */
export async function sincronizarPlantillas() {
  if (!N8N_PLANTILLAS_WEBHOOK) {
    throw new Error("Falta configurar VITE_N8N_PLANTILLAS_WEBHOOK con la URL del workflow de n8n.");
  }

  let json;
  try {
    const res = await fetch(N8N_PLANTILLAS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    json = await res.json();
  } catch (e) {
    throw new Error(`No se pudo hablar con n8n: ${e.message}`);
  }

  if (json?.error) {
    const e = json.error;
    // El 200 de Meta es siempre lo mismo: al token le falta el permiso de gestión.
    if (String(e.code) === "200") {
      throw new Error("Meta rechazó la consulta: al token le falta el permiso whatsapp_business_management.");
    }
    throw new Error(`Meta respondió: ${e.message || e.code}`);
  }

  const plantillas = json?.data;
  if (!Array.isArray(plantillas)) {
    throw new Error("n8n no devolvió la lista de plantillas. Revisá que el WABA ID esté cargado en el workflow.");
  }

  const ahora = new Date().toISOString();
  const filas = plantillas.map((t) => {
    const comps  = t.components || [];
    const cuerpo = comps.find((c) => c.type === "BODY")?.text || null;
    // La cabecera con archivo hay que volver a mandarla en cada envío: nos
    // guardamos de qué tipo es y el ejemplo que aprobó Meta, para arrancar.
    const header = comps.find((c) => c.type === "HEADER");
    return {
      nombre: t.name,
      idioma: t.language,
      categoria: t.category || "MARKETING",
      cuerpo,
      header_tipo: header?.format || null,
      header_ejemplo: header?.example?.header_handle?.[0] || null,
      variables: variablesDelCuerpo(cuerpo).map((n) => ({ num: n })),
      // Sólo se puede mandar lo que Meta aprobó.
      activa: t.status === "APPROVED",
      estado_meta: t.status || null,
      sincronizada_at: ahora,
    };
  });

  if (filas.length) {
    const { error } = await supabase
      .from("plantillas_wa").upsert(filas, { onConflict: "nombre,idioma" });
    if (error) throw new Error(`No se pudieron guardar: ${error.message}`);
  }

  const aprobadas = filas.filter((f) => f.activa);
  return {
    total: filas.length,
    aprobadas: aprobadas.length,
    otras: filas.length - aprobadas.length,
    nombres: aprobadas.map((f) => f.nombre),
  };
}

// ── Audiencia ───────────────────────────────────────────────
/**
 * Trae los contactos que cumplen los filtros de la campaña.
 *
 * @param {object} filtros
 *   estados[]        estados del pipeline a incluir (vacío = todos)
 *   vendedores[]     vendedores a incluir (vacío = todos)
 *   soloConCharla    sólo los que alguna vez escribieron
 *   excluirVendedores  saca de la lista a los contactos que son vendedores
 *   excluirCampania  id de una campaña previa: no repetirle a quien ya recibió esa
 */
export async function buscarAudiencia(filtros = {}) {
  let q = supabase
    .from("contactos")
    .select("id,nombre,telefono,estado,vendedor,empresa,ultimo_in_at,es_vendedor")
    .not("telefono", "is", null);

  if (filtros.estados?.length)    q = q.in("estado", filtros.estados);
  if (filtros.vendedores?.length) q = q.in("vendedor", filtros.vendedores);
  if (filtros.soloConCharla)      q = q.not("ultimo_in_at", "is", null);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);

  let lista = (data || []).filter((c) => String(c.telefono || "").replace(/\D/g, "").length >= 8);
  if (filtros.excluirVendedores !== false) lista = lista.filter((c) => !c.es_vendedor);

  if (filtros.excluirCampania) {
    const { data: previos } = await supabase
      .from("campania_envios").select("contacto_id")
      .eq("campania_id", filtros.excluirCampania).eq("estado", "enviado");
    const ya = new Set((previos || []).map((p) => p.contacto_id));
    lista = lista.filter((c) => !ya.has(c.id));
  }
  return lista;
}

// ── Envío ───────────────────────────────────────────────────
/**
 * Manda una plantilla a un teléfono a través del webhook de n8n.
 * Devuelve { ok, id?, error? }. Nunca tira excepción: cada envío
 * falla por su cuenta sin cortar la campaña.
 */
export async function enviarPlantilla({ telefono, plantilla, idioma, parametros, headerUrl, headerTipo }) {
  if (!N8N_SEND_WEBHOOK) return { ok: false, error: "Falta configurar el webhook de envío (VITE_N8N_SEND_WEBHOOK)." };

  try {
    const res = await fetch(N8N_SEND_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: String(telefono).replace(/D/g, ""),
        plantilla, idioma, parametros,
        // Si la plantilla lleva cabecera con archivo, Meta la exige en cada envío.
        ...(headerUrl ? { header_url: headerUrl, header_tipo: (headerTipo || "IMAGE").toLowerCase() } : {}),
      }),
    });

    let cuerpo = null;
    try { cuerpo = await res.json(); } catch { /* n8n puede contestar vacío */ }

    // Meta contesta { messages: [{ id }] } cuando salió, y { error: {...} } cuando no.
    if (cuerpo?.error) {
      const e = cuerpo.error;
      return { ok: false, error: `${e.code || res.status}: ${e.message || "rechazado por Meta"}` };
    }
    if (!res.ok) return { ok: false, error: `El envío devolvió ${res.status}` };

    // El workflow viejo contestaba { ok: true } sin pasar por Meta. Si vemos
    // eso, el mensaje no salió: avisamos en vez de contarlo como enviado.
    if (cuerpo && cuerpo.ok === true && !cuerpo.messages) {
      return { ok: false, error: "El workflow MunichCRM-Send de n8n está sin actualizar: todavía no sabe mandar plantillas." };
    }

    return { ok: true, id: cuerpo?.messages?.[0]?.id || null };
  } catch (e) {
    return { ok: false, error: e.message || "No se pudo conectar" };
  }
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Procesa los envíos pendientes de una campaña, de a uno y con pausa.
 *
 * Los mensajes salen espaciados a propósito: Meta corta el chorro si
 * mandás demasiado rápido, y encima así se puede frenar en el medio.
 *
 * @param {object} campania    fila de `campanias`
 * @param {()=>boolean} seguir  se consulta antes de cada envío; false = frenar
 * @param {(p:object)=>void} onAvance  progreso para la pantalla
 * @param {number} pausaMs
 */
export async function procesarPendientes(campania, seguir, onAvance, pausaMs = 400) {
  let enviados = 0, fallidos = 0;

  while (seguir()) {
    const { data: lote, error } = await supabase
      .from("campania_envios").select("*")
      .eq("campania_id", campania.id).eq("estado", "pendiente")
      .order("created_at", { ascending: true }).limit(25);

    if (error) throw new Error(error.message);
    if (!lote?.length) break;

    for (const envio of lote) {
      if (!seguir()) break;

      const r = await enviarPlantilla({
        telefono: envio.telefono,
        plantilla: campania.plantilla,
        idioma: campania.idioma,
        parametros: envio.parametros || [],
        headerUrl: campania.header_url,
        headerTipo: campania.header_tipo,
      });

      await supabase.from("campania_envios").update({
        estado: r.ok ? "enviado" : "fallido",
        error: r.ok ? null : String(r.error).slice(0, 300),
        wa_message_id: r.id || null,
        enviado_at: new Date().toISOString(),
      }).eq("id", envio.id);

      if (r.ok) enviados++; else fallidos++;
      onAvance?.({ enviados, fallidos, ultimo: envio.nombre || envio.telefono, ok: r.ok });

      await dormir(pausaMs);
    }
  }

  return { enviados, fallidos };
}
