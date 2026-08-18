// ============================================================
// Muni — motor del asistente IA
// ------------------------------------------------------------
// Acá vive todo lo que el asistente sabe hacer: las herramientas
// que puede ejecutar sobre el CRM y el ciclo de conversación con
// el modelo. El componente visual (AIAsistente en App.jsx) sólo
// se ocupa de mostrar los mensajes.
//
// El modelo decide qué herramienta usar; nosotros la ejecutamos
// contra Supabase y le devolvemos el resultado para que siga.
// ============================================================
import { supabase, ESTADOS, ESTADOS_ACTIVOS, VENDEDORES, limpiarPrecios } from "./lib";

export const MODELO = "openai/gpt-oss-120b";
const API = "https://api.groq.com/openai/v1/chat/completions";

/** La clave de Groq. El nombre de la variable quedó de la época de Grok. */
export function claveIA() {
  return import.meta.env.VITE_GROK_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
}

const iso = (d) => new Date(d).toISOString();
const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d;
};
const fechaCorta = (v) =>
  v ? new Date(v).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : null;

// Los campos que le pasamos al modelo: los justos, para no gastar contexto.
const CAMPOS_CONTACTO = "id,nombre,telefono,estado,vendedor,empresa,direccion,email,nota_seguimiento,seguimiento_at,ultimo_msg,ultimo_in_at,ultimo_out_at,bot_activo,created_at";

function resumirContacto(c) {
  return {
    id: c.id,
    nombre: c.nombre || "(sin nombre)",
    telefono: c.telefono,
    estado: ESTADOS[c.estado]?.label || c.estado,
    vendedor: c.vendedor || "sin asignar",
    empresa: c.empresa || undefined,
    direccion: c.direccion || undefined,
    nota: c.nota_seguimiento || undefined,
    seguimiento: fechaCorta(c.seguimiento_at) || undefined,
    ultimo_mensaje: c.ultimo_msg ? String(c.ultimo_msg).slice(0, 120) : undefined,
    sin_responder:
      !!c.ultimo_in_at && (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at)),
  };
}

function resumirPedido(p, parse) {
  const d = parse(p.detalle);
  const items = (d.items || []).filter((i) => i.desc?.trim());
  return {
    id: p.id,
    fecha: fechaCorta(p.created_at),
    tipo: d.tipo || "pedido",
    estado: p.estado,
    vendedor: p.vendedor || "sin asignar",
    total: Number(p.total) || 0,
    articulos: items.length
      ? items.map((i) => `${i.qty || 1}x ${limpiarPrecios(i.desc)}`).join(", ")
      : d.observacion || "—",
    entrega: d.fecha_entrega || undefined,
  };
}

// ============================================================
// HERRAMIENTAS — lo que Muni puede hacer
// ============================================================
export const HERRAMIENTAS = [
  {
    type: "function",
    function: {
      name: "buscar_contactos",
      description:
        "Busca clientes por nombre, teléfono, estado o vendedor. Usala para conseguir el id de un contacto.",
      parameters: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Nombre o teléfono" },
          estado: { type: "string", enum: ESTADOS_ACTIVOS },
          vendedor: { type: "string" },
          sin_responder: { type: "boolean", description: "Sólo los que esperan respuesta" },
          limite: { type: "integer" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_contacto",
      description:
        "Ficha del cliente: datos, últimos pedidos y lo último que se habló.",
      parameters: {
        type: "object",
        properties: { contacto_id: { type: "string" } },
        required: ["contacto_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_contacto",
      description:
        "Cambia datos de un cliente. Mandá sólo lo que cambia.",
      parameters: {
        type: "object",
        properties: {
          contacto_id: { type: "string" },
          estado: { type: "string", enum: ESTADOS_ACTIVOS },
          vendedor: { type: "string", description: "Puede ser uno nuevo" },
          nombre: { type: "string" },
          empresa: { type: "string" },
          direccion: { type: "string" },
          email: { type: "string" },
          nota: { type: "string" },
        },
        required: ["contacto_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_seguimiento",
      description: "Agenda un recordatorio para recontactar a un cliente.",
      parameters: {
        type: "object",
        properties: {
          contacto_id: { type: "string" },
          dias: { type: "integer", description: "En cuántos días" },
          motivo: { type: "string" },
        },
        required: ["contacto_id", "dias", "motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_pedido",
      description: "Carga un pedido nuevo para un cliente.",
      parameters: {
        type: "object",
        properties: {
          contacto_id: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                desc: { type: "string" },
                qty: { type: "integer" },
                precio: { type: "number" },
              },
              required: ["desc"],
            },
          },
          notas: { type: "string" },
          entrega: { type: "string", enum: ["Retiro en local", "Delivery"] },
          direccion: { type: "string" },
          pago: { type: "string", enum: ["Efectivo", "Transferencia", "Tarjeta", "Mercado Pago"] },
          fecha_entrega: { type: "string", description: "AAAA-MM-DD" },
        },
        required: ["contacto_id", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_pedidos",
      description: "Pedidos y visitas de los últimos días.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "integer", description: "Días hacia atrás" },
          estado: { type: "string" },
          vendedor: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_evento",
      description:
        "Agenda un evento en el calendario.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          tipo: { type: "string", enum: ["reunion", "visita", "entrega", "recordatorio", "otro"] },
          fecha: { type: "string", description: "AAAA-MM-DD" },
          hora: { type: "string", description: "HH:MM. Sin hora = todo el día" },
          duracion_min: { type: "integer" },
          lugar: { type: "string" },
          vendedor: { type: "string" },
          descripcion: { type: "string" },
        },
        required: ["titulo", "fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_eventos",
      description: "Qué hay agendado entre dos fechas.",
      parameters: {
        type: "object",
        properties: {
          desde: { type: "string", description: "AAAA-MM-DD" },
          hasta: { type: "string", description: "AAAA-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "metricas",
      description:
        "Números del negocio: nuevos, pipeline, pedidos, facturación y ranking.",
      parameters: {
        type: "object",
        properties: { dias: { type: "integer", description: "Período en días" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proponer_whatsapp",
      description:
        "Deja listo un WhatsApp para un cliente. No lo envía: lo aprueba la persona. Usala siempre que te pidan escribirle a alguien.",
      parameters: {
        type: "object",
        properties: {
          contacto_id: { type: "string" },
          texto: { type: "string", description: "El mensaje tal cual" },
        },
        required: ["contacto_id", "texto"],
      },
    },
  },
];

// ============================================================
// EJECUCIÓN DE HERRAMIENTAS
// ============================================================
/**
 * Corre una herramienta contra Supabase.
 * Devuelve { datos, resumen, propuesta? } — `resumen` es la línea que se le
 * muestra a la persona ("Estado cambiado a Vendido").
 */
export async function ejecutarHerramienta(nombre, args, ctx = {}) {
  const { parse = () => ({}) } = ctx;

  switch (nombre) {
    case "buscar_contactos": {
      let q = supabase.from("contactos").select(CAMPOS_CONTACTO);
      if (args.texto) {
        const t = String(args.texto).trim();
        q = q.or(`nombre.ilike.%${t}%,telefono.ilike.%${t}%,empresa.ilike.%${t}%`);
      }
      if (args.estado) q = q.eq("estado", args.estado);
      if (args.vendedor) q = q.eq("vendedor", args.vendedor);
      const { data, error } = await q
        .order("ultimo_in_at", { ascending: false, nullsFirst: false })
        .limit(Math.min(args.limite || 15, 40));
      if (error) return { error: error.message };

      let filas = data || [];
      if (args.sin_responder) {
        filas = filas.filter(
          (c) => c.ultimo_in_at && (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at))
        );
      }
      return {
        datos: { encontrados: filas.length, contactos: filas.map(resumirContacto) },
        resumen: `Busqué clientes · ${filas.length} resultado${filas.length === 1 ? "" : "s"}`,
      };
    }

    case "ver_contacto": {
      const [cRes, pRes, mRes] = await Promise.all([
        supabase.from("contactos").select(CAMPOS_CONTACTO).eq("id", args.contacto_id).single(),
        supabase.from("pedidos").select("*").eq("contacto_id", args.contacto_id).order("created_at", { ascending: false }).limit(5),
        supabase.from("mensajes").select("direccion,contenido,created_at").eq("contacto_id", args.contacto_id).order("created_at", { ascending: false }).limit(12),
      ]);
      if (cRes.error) return { error: cRes.error.message };
      return {
        datos: {
          contacto: resumirContacto(cRes.data),
          pedidos: (pRes.data || []).map((p) => resumirPedido(p, parse)),
          conversacion: (mRes.data || []).reverse().map((m) => ({
            quien: m.direccion === "in" ? "cliente" : "nosotros",
            texto: String(m.contenido || "").slice(0, 200),
            cuando: fechaCorta(m.created_at),
          })),
        },
        resumen: `Abrí la ficha de ${cRes.data.nombre || cRes.data.telefono}`,
      };
    }

    case "actualizar_contacto": {
      const cambios = {};
      if (args.estado) cambios.estado = args.estado;
      if (args.vendedor) cambios.vendedor = args.vendedor;
      if (args.nombre) cambios.nombre = args.nombre;
      if (args.empresa) cambios.empresa = args.empresa;
      if (args.direccion) cambios.direccion = args.direccion;
      if (args.email) cambios.email = args.email;
      if (args.nota) cambios.nota_seguimiento = args.nota;
      if (!Object.keys(cambios).length) return { error: "No mandaste ningún campo para cambiar." };

      const { data, error } = await supabase
        .from("contactos").update(cambios).eq("id", args.contacto_id).select(CAMPOS_CONTACTO).single();
      if (error) return { error: error.message };

      const partes = [];
      if (cambios.estado) partes.push(`estado → ${ESTADOS[cambios.estado]?.label || cambios.estado}`);
      if (cambios.vendedor) partes.push(`vendedor → ${cambios.vendedor}`);
      if (cambios.nota) partes.push("nota guardada");
      for (const k of ["nombre", "empresa", "direccion", "email"]) if (cambios[k]) partes.push(k);
      return {
        datos: { ok: true, contacto: resumirContacto(data) },
        resumen: `${data.nombre || data.telefono}: ${partes.join(" · ")}`,
        contactoActualizado: data,
      };
    }

    case "agendar_seguimiento": {
      const dias = Math.max(0, parseInt(args.dias, 10) || 1);
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + dias);
      fecha.setHours(10, 0, 0, 0);
      const { data, error } = await supabase
        .from("contactos")
        .update({ seguimiento_at: iso(fecha), nota_seguimiento: args.motivo })
        .eq("id", args.contacto_id).select(CAMPOS_CONTACTO).single();
      if (error) return { error: error.message };
      return {
        datos: { ok: true, seguimiento: iso(fecha) },
        resumen: `Seguimiento el ${fecha.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })} — ${args.motivo}`,
        contactoActualizado: data,
      };
    }

    case "crear_pedido": {
      const { data: cont } = await supabase
        .from("contactos").select("id,nombre,telefono,vendedor,direccion").eq("id", args.contacto_id).single();
      const items = (args.items || []).map((i) => ({
        desc: i.desc, qty: i.qty || 1, precio: Number(i.precio) || 0,
      }));
      const detalle = JSON.stringify({
        tipo: "pedido",
        items,
        notas: args.notas || "",
        entrega: args.entrega || "Retiro en local",
        direccion: args.direccion || cont?.direccion || "",
        pago: args.pago || "Efectivo",
        ...(args.fecha_entrega ? { fecha_entrega: args.fecha_entrega } : {}),
      });
      const total = items.reduce((s, i) => s + (i.precio || 0) * (i.qty || 1), 0);
      const { data, error } = await supabase.from("pedidos").insert({
        contacto_id: args.contacto_id,
        vendedor: cont?.vendedor || "",
        detalle, total, estado: "pendiente",
      }).select().single();
      if (error) return { error: error.message };
      return {
        datos: { ok: true, pedido_id: data.id, total },
        resumen: `Pedido cargado para ${cont?.nombre || "el cliente"} · ${items.map((i) => `${i.qty}x ${i.desc}`).join(", ")}`,
      };
    }

    case "listar_pedidos": {
      const dias = args.dias || 7;
      let q = supabase.from("pedidos").select("*").gte("created_at", iso(hace(dias)));
      if (args.estado) q = q.eq("estado", args.estado);
      if (args.vendedor) q = q.eq("vendedor", args.vendedor);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(40);
      if (error) return { error: error.message };

      const ids = [...new Set((data || []).map((p) => p.contacto_id).filter(Boolean))];
      const { data: conts } = ids.length
        ? await supabase.from("contactos").select("id,nombre,telefono").in("id", ids)
        : { data: [] };
      const mapa = Object.fromEntries((conts || []).map((c) => [c.id, c.nombre || c.telefono]));

      const filas = (data || []).map((p) => ({ ...resumirPedido(p, parse), cliente: mapa[p.contacto_id] || "—" }));
      return {
        datos: { periodo_dias: dias, cantidad: filas.length, pedidos: filas },
        resumen: `Miré los últimos ${dias} días · ${filas.length} entrada${filas.length === 1 ? "" : "s"}`,
      };
    }

    case "crear_evento": {
      const hora = args.hora && /^\d{1,2}:\d{2}$/.test(args.hora) ? args.hora : null;
      const inicio = new Date(`${args.fecha}T${hora || "00:00"}:00`);
      if (isNaN(inicio)) return { error: "La fecha no es válida. Usá el formato AAAA-MM-DD." };
      const fin = hora ? new Date(inicio.getTime() + (args.duracion_min || 60) * 60000) : null;

      const { data, error } = await supabase.from("eventos").insert({
        titulo: args.titulo,
        tipo: args.tipo || "reunion",
        inicio: iso(inicio),
        fin: fin ? iso(fin) : null,
        todo_el_dia: !hora,
        lugar: args.lugar || null,
        vendedor: args.vendedor || null,
        descripcion: args.descripcion || null,
        creado_por: ctx.userEmail || null,
      }).select().single();
      if (error) return { error: error.message };
      return {
        datos: { ok: true, evento_id: data.id },
        resumen: `Agendado: ${args.titulo} · ${inicio.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" })}${hora ? ` ${hora}` : ""}`,
        evento: data,
      };
    }

    case "listar_eventos": {
      const desde = args.desde ? new Date(`${args.desde}T00:00:00`) : new Date();
      const hasta = args.hasta ? new Date(`${args.hasta}T23:59:59`) : new Date(Date.now() + 14 * 86400000);
      const { data, error } = await supabase
        .from("eventos").select("*")
        .gte("inicio", iso(desde)).lte("inicio", iso(hasta))
        .order("inicio", { ascending: true }).limit(50);
      if (error) return { error: error.message };
      return {
        datos: {
          cantidad: (data || []).length,
          eventos: (data || []).map((e) => ({
            id: e.id, titulo: e.titulo, tipo: e.tipo,
            cuando: new Date(e.inicio).toLocaleString("es-AR", {
              weekday: "short", day: "2-digit", month: "2-digit",
              ...(e.todo_el_dia ? {} : { hour: "2-digit", minute: "2-digit" }),
            }),
            lugar: e.lugar || undefined, vendedor: e.vendedor || undefined,
          })),
        },
        resumen: `Revisé la agenda · ${(data || []).length} evento${(data || []).length === 1 ? "" : "s"}`,
      };
    }

    case "metricas": {
      const dias = args.dias || 7;
      const desde = hace(dias);
      const [cRes, pRes, mRes] = await Promise.all([
        supabase.from("contactos").select("id,estado,vendedor,created_at,ultimo_in_at,ultimo_out_at"),
        supabase.from("pedidos").select("id,total,estado,vendedor,created_at").gte("created_at", iso(desde)),
        supabase.from("mensajes").select("id,direccion,created_at").gte("created_at", iso(desde)),
      ]);
      const contactos = cRes.data || [], pedidos = pRes.data || [], mensajes = mRes.data || [];
      const hoy = new Date().toDateString();

      const pipeline = {};
      for (const c of contactos) {
        const k = ESTADOS[c.estado]?.label || c.estado;
        pipeline[k] = (pipeline[k] || 0) + 1;
      }
      const ranking = VENDEDORES
        .map((v) => {
          const suyos = pedidos.filter((p) => p.vendedor === v);
          return { vendedor: v, pedidos: suyos.length, facturado: suyos.reduce((s, p) => s + (Number(p.total) || 0), 0) };
        })
        .filter((v) => v.pedidos > 0)
        .sort((a, b) => b.pedidos - a.pedidos);

      return {
        datos: {
          periodo_dias: dias,
          contactos_totales: contactos.length,
          nuevos_hoy: contactos.filter((c) => new Date(c.created_at).toDateString() === hoy).length,
          nuevos_periodo: contactos.filter((c) => new Date(c.created_at) >= desde).length,
          pipeline,
          sin_responder: contactos.filter(
            (c) => c.ultimo_in_at && (!c.ultimo_out_at || new Date(c.ultimo_in_at) > new Date(c.ultimo_out_at))
          ).length,
          pedidos_periodo: pedidos.length,
          facturacion_periodo: pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0),
          mensajes_recibidos: mensajes.filter((m) => m.direccion === "in").length,
          ranking_vendedores: ranking,
        },
        resumen: `Saqué los números de los últimos ${dias} días`,
      };
    }

    case "proponer_whatsapp": {
      const { data, error } = await supabase
        .from("contactos").select("id,nombre,telefono").eq("id", args.contacto_id).single();
      if (error) return { error: error.message };
      return {
        datos: { ok: true, aviso: "El mensaje quedó como propuesta; lo envía la persona desde el panel." },
        resumen: `Mensaje listo para ${data.nombre || data.telefono}`,
        propuesta: { contacto: data, texto: args.texto },
      };
    }

    default:
      return { error: `No conozco la herramienta ${nombre}.` };
  }
}

// ============================================================
// PROMPT DEL SISTEMA
// ============================================================
export function construirSistema({ userName, contactoActivo, resumen }) {
  const hoy = new Date();
  return `Sos **Muni**, el asistente de ${userName || "Cristian"} en Nuevo Munich, una hamburguesería artesanal premium que vende sobre todo por WhatsApp.

No sos un chatbot de ayuda: sos un empleado más del equipo. Trabajás para ${userName || "Cristian"}, que es el dueño, y le respondés cualquier cosa que te pregunte —del negocio o de lo que sea— igual que un colega de confianza. Si la pregunta no tiene nada que ver con el CRM, contestala igual y con ganas.

HOY ES ${hoy.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} (${hoy.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}).

FOTO DEL NEGOCIO AHORA MISMO:
${resumen}

CÓMO TRABAJÁS
- Tenés herramientas para operar el CRM de verdad: buscar clientes, cambiar estados, asignar vendedores, cargar pedidos, agendar seguimientos y eventos, y sacar métricas. Usalas en vez de suponer.
- Cuando te nombran un cliente por su nombre, buscalo primero con buscar_contactos para tener su id. No inventes ids.
- Encadená lo que haga falta: si te piden "pasá a Panadería a vendido y agendale seguimiento", buscá, cambiá el estado y agendá, todo de una.
- Cosas que cambian datos (estado, vendedor, pedidos, eventos, seguimientos): hacelas directamente cuando te las piden. No pidas permiso para algo que ya te pidieron.
- Para escribirle a un cliente usá siempre proponer_whatsapp. El mensaje queda esperando que la persona toque "Enviar": nunca sale solo, y eso está bien.
- Si algo te falta para actuar (por ejemplo, no sabés a qué cliente se refieren), preguntá una sola cosa concreta.

CÓMO HABLÁS
- Español rioplatense (vos), cálido y directo, como un compañero de laburo. Nada de tono corporativo.
- Respuestas cortas y masticadas. Si podés contestar en dos líneas, contestá en dos líneas.
- Usá *negrita* para lo importante. Nada de listas larguísimas ni de cerrar siempre con "¿algo más?".
- Cuando ejecutás algo, decilo en una línea y seguí. La persona ya ve el detalle en pantalla.
- Si ves algo que conviene mirar (clientes sin responder hace rato, un vendedor frenado, un seguimiento vencido), mencionalo aunque no te lo pregunten.

${contactoActivo
  ? `CLIENTE ABIERTO EN PANTALLA AHORA (usá este id salvo que te digan otra cosa):
• id: ${contactoActivo.id}
• ${contactoActivo.nombre || "(sin nombre)"} — ${contactoActivo.telefono}
• Estado: ${ESTADOS[contactoActivo.estado]?.label || contactoActivo.estado} · Vendedor: ${contactoActivo.vendedor || "sin asignar"}${contactoActivo.nota_seguimiento ? `\n• Nota: ${contactoActivo.nota_seguimiento}` : ""}`
  : "No hay ningún cliente abierto en pantalla. Si hace falta uno, buscalo."}`;
}

// ============================================================
// CICLO DE CONVERSACIÓN
// ============================================================
/**
 * Manda la charla al modelo y va ejecutando las herramientas que pida,
 * hasta que responda con texto.
 *
 * @param {object[]} historial  mensajes [{role, content}]
 * @param {string}   sistema    prompt del sistema
 * @param {object}   ctx        { parse, userEmail }
 * @param {(a:object)=>void} onAccion  se llama con cada acción ejecutada
 * @returns {Promise<{texto:string, acciones:object[], propuestas:object[], contactoActualizado:object|null}>}
 */
/**
 * Una llamada a la API, con reintento si nos frena el límite de uso.
 *
 * El plan gratuito de Groq deja pasar 8.000 tokens por minuto, y cada
 * pregunta con herramientas se come unos 2.500. Cuando nos pasamos, la API
 * contesta 429 y avisa cuánto falta: esperamos eso y volvemos a intentar,
 * así la persona no ve un error por algo que se destraba en dos segundos.
 */
async function pedir(key, cuerpo, intento = 0) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(cuerpo),
  });

  if (res.status === 429 && intento < 2) {
    const cabecera = Number(res.headers.get("retry-after"));
    const texto = await res.text();
    const enTexto = texto.match(/try again in ([\d.]+)s/i);
    const espera = (cabecera || (enTexto ? parseFloat(enTexto[1]) : 3) || 3) * 1000;
    await new Promise((r) => setTimeout(r, Math.min(espera + 400, 12000)));
    return pedir(key, cuerpo, intento + 1);
  }

  const json = await res.json();
  if (json.error) {
    const msg = json.error.message || json.error.type || "Error de la IA";
    throw new Error(
      res.status === 429
        ? "Estoy al tope del límite gratuito de la IA. Esperá un minuto y preguntame de nuevo."
        : msg
    );
  }
  return json;
}

export async function conversar({ historial, sistema, ctx = {}, onAccion }) {
  const key = claveIA();
  if (!key) throw new Error("Falta configurar VITE_GROK_API_KEY en las variables de entorno.");

  const mensajes = [{ role: "system", content: sistema }, ...historial];
  const acciones = [];
  const propuestas = [];
  let contactoActualizado = null;

  // Hasta 4 vueltas: alcanza para encadenar varias acciones sin colgarse.
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    // max_tokens chico a propósito: cuenta contra el límite por minuto
    // apenas se pide, y las respuestas de Muni son cortas igual.
    const json = await pedir(key, {
      model: MODELO,
      messages: mensajes,
      tools: HERRAMIENTAS,
      tool_choice: "auto",
      temperature: 0.6,
      max_tokens: 700,
      reasoning_effort: "low",
    });

    const msg = json.choices?.[0]?.message;
    if (!msg) throw new Error("La IA no devolvió respuesta.");

    const llamadas = msg.tool_calls || [];
    if (!llamadas.length) {
      return { texto: (msg.content || "").trim() || "…", acciones, propuestas, contactoActualizado };
    }

    // Reinyectamos el turno del modelo sin el campo `reasoning`, que la API no acepta de vuelta.
    mensajes.push({ role: "assistant", content: msg.content || "", tool_calls: llamadas });

    for (const llamada of llamadas) {
      let args = {};
      try { args = JSON.parse(llamada.function.arguments || "{}"); } catch { /* argumentos rotos */ }

      let salida;
      try {
        salida = await ejecutarHerramienta(llamada.function.name, args, ctx);
      } catch (e) {
        salida = { error: e.message };
      }

      if (salida.resumen) {
        const accion = { herramienta: llamada.function.name, resumen: salida.resumen };
        acciones.push(accion);
        onAccion?.(accion);
      }
      if (salida.propuesta) propuestas.push(salida.propuesta);
      if (salida.contactoActualizado) contactoActualizado = salida.contactoActualizado;

      mensajes.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: JSON.stringify(salida.error ? { error: salida.error } : salida.datos ?? {}),
      });
    }
  }

  return {
    texto: "Hice varias cosas seguidas y me quedé sin vueltas. Preguntame de nuevo para seguir.",
    acciones, propuestas, contactoActualizado,
  };
}
