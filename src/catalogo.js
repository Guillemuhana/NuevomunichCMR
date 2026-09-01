// ── Catálogo de productos ────────────────────────────────────
// Los vendedores tipeaban el nombre de cada producto a mano en el pedido:
// salían diez formas distintas de escribir "Knackwurst" y después no había
// manera de sumar cuánto se vendió de cada cosa. Esta es la lista oficial;
// el buscador del formulario come de acá.
//
// Sale de la LISTA 2 (vigencia 31/08/2026): mismos códigos, mismos nombres y
// el mismo orden que la planilla impresa, dividido en los mismos bloques
// —incluida la Línea Ogianco, que allá va aparte—. Así el vendedor que tiene
// la hoja en la mano encuentra cada cosa donde la está mirando, y el cliente
// que canta "mandame diez del 05" se entiende de una.
//
// Los precios NO están acá a propósito: cambian con cada lista nueva y el
// pedido los carga a mano. Acá vive qué se vende, no a cuánto.
//
// Se puede seguir escribiendo libre (hay productos nuevos, promos, cosas
// puntuales), pero lo que está en la lista se elige de un toque.

// Cada producto es [código, nombre]. El código va vacío cuando la lista de
// precios no le asignó uno (las cajas y la picada).
const GRUPOS = [
  {
    cat: "Salchichas",
    icono: "🌭",
    items: [
      ["01", "Salchicha Knackwurst (Chorizo Alemán) x 3"],
      ["02", "Salchicha Knackwurst (Chorizo Alemán) x 12"],
      ["03", "Salchicha Knackwurst (Chorizo Alemán) x 50"],
      ["11", "Salchicha tipo Viena x 18"],
      ["10", "Salchicha tipo Viena x 5"],
      ["74", "Salchicha tipo Viena x 3"],
      ["06", "Salchicha tipo Frankfurt x 50"],
      ["05", "Salchicha tipo Frankfurt x 20"],
      ["04", "Salchicha tipo Frankfurt x 5"],
      ["81", "Salchicha tipo Frankfurt x 3"],
      ["08", "Salchicha Húngara x 18"],
      ["80", "Salchicha Húngara x 3"],
      ["17", "Salchicha Weisswurst (Chorizo Blanco) x 12"],
      ["16", "Salchicha Weisswurst (Chorizo Blanco) x 3"],
      ["194", "Salchicha Bratwurst x 3"],
      ["196", "Salchicha Bratwurst x 50 aprox."],
    ],
  },
  {
    cat: "Copetín y roscas",
    icono: "🥨",
    items: [
      ["42", "Rosca Polaca"],
      ["13", "Copetín Viena"],
      ["85", "Copetín Viena a granel (aprox. 3 kg)"],
      ["14", "Copetín Húngaro"],
      ["21", "Copetín Húngaro a granel (aprox. 3 kg)"],
    ],
  },
  {
    cat: "Salames y embutidos",
    icono: "🍖",
    items: [
      ["15", "Salchichón Ahumado"],
      ["24", "Leberwurst"],
      ["25", "Leberwurst (Fracción)"],
      ["23", "Leberwurst (Plancha)"],
      ["31", "Holstein (Salame Ahumado Picado Fino)"],
      ["32", "Holstein (Fracción)"],
      ["30", "Holstein (Plancha)"],
      ["34", "Alpino (Salame Ahumado Picado Grueso)"],
      ["35", "Alpino (Fracción)"],
      ["33", "Alpino (Plancha)"],
      ["36", "Cracovia para Fetear"],
      ["38", "Cracovia Fina"],
      ["39", "Cracovia Fina (Fracción)"],
      ["37", "Cracovia Fina (Plancha)"],
      ["22", "Leberkase"],
      ["26", "Salame Tipo Colonia"],
      ["28", "Salame Tipo Colonia Envasado al Vacío"],
    ],
  },
  {
    cat: "Cerdo y ahumados",
    icono: "🐖",
    items: [
      ["53", "Lomo de Cerdo Ahumado"],
      ["54", "Lomo de Cerdo Ahumado (Fracción)"],
      ["92", "Lomo de Cerdo a las Finas Hierbas"],
      ["220", "Lomo de Cerdo a las Finas Hierbas (Fracción)"],
      ["40", "Panceta Ahumada"],
      ["41", "Panceta (Fracción)"],
      ["55", "Karre de Cerdo Ahumado"],
      ["56", "Kassler (Costeletitas de Cerdo)"],
      ["57", "Kassler x 2 unidades"],
      ["49", "Bondiola Envasada al Vacío"],
      ["50", "Bondiola (Fracción)"],
    ],
  },
  {
    cat: "Jamones y arrollados",
    icono: "🍗",
    items: [
      ["45", "Jamón Asado (Media Pieza)"],
      ["60", "Jamón Cocido Natural con Cuero"],
      ["48", "Jamón Bávaro"],
      ["63", "Matambre Arrollado"],
      ["64", "Matambre Arrollado (Fracción)"],
      ["61", "Arrollado de Pollo"],
      ["62", "Arrollado de Pollo (Fracción)"],
      ["65", "Arrollado Criollo"],
      ["66", "Arrollado Criollo (Fracción)"],
    ],
  },
  {
    // En la lista impresa es un recuadro propio, con su marca. El arrollado
    // y el matambre Ogianco no son los mismos que los de arriba —otro código,
    // otro precio—, así que llevan la marca en el nombre: si en el pedido
    // dijera sólo "Arrollado de Pollo" no habría manera de saber cuál es.
    cat: "Línea Ogianco",
    icono: "🏷️",
    items: [
      ["84", "Arrollado de Pollo Ogianco"],
      ["83", "Matambre Arrollado Ogianco"],
      ["20", "Salchicha Ogianco x 6 unid 0,200 gr (10 cm)"],
      ["125", "Salchicha Ogianco x 50 unid (10 cm)"],
      ["121", "Salchicha Ogianco x 5 unid 0,400 gr (23 cm)"],
      ["120", "Salchicha Ogianco x 50 unid (23 cm)"],
    ],
  },
  {
    // La lista los pone como "Jamón Cocido", "Bondiola", etc. bajo el título
    // FETEADOS. Acá el nombre viaja solo dentro del pedido, así que cada uno
    // se lleva el "Feteado" puesto para no confundirse con la pieza entera.
    cat: "Feteados",
    icono: "🔪",
    nota: "Por 100 gr aproximadamente",
    items: [
      ["520", "Jamón Cocido Feteado"],
      ["521", "Bondiola Feteada"],
      ["522", "Arrollado de Pollo Feteado"],
      ["528", "Arrollado Criollo Feteado"],
      ["524", "Jamón Tipo Asado Feteado"],
      ["525", "Jamón Bávaro Feteado"],
      ["523", "Panceta Ahumada Feteada"],
      ["526", "Lomo de Cerdo Ahumado Feteado"],
      ["527", "Lomo de Cerdo a las Finas Hierbas Feteado"],
    ],
  },
  {
    cat: "Cajas y picadas",
    icono: "🎁",
    items: [
      ["", "Caja de Regalo (Incluye 5 Productos Fracción)"],
      ["", "Caja de Madera (Incluye 7 Productos)"],
      ["", "Picada envasada al vacío"],
    ],
  },
];

/** Sin tildes, sin mayúsculas: así "jamon bavaro" encuentra "Jamón Bávaro". */
export function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Las listas de la pantalla (el popover, el modal, los "usados últimamente")
// trabajan con el nombre como identidad del producto: es lo que se guarda en
// el pedido y lo que el vendedor lee. El código es un dato al costado —se
// busca con codigoDe()— para no tener que tocar cada lista de la app.
export const CATALOGO = GRUPOS.map(g => ({
  cat: g.cat,
  icono: g.icono,
  nota: g.nota || "",
  items: g.items.map(([, nombre]) => nombre),
}));

/** La lista plana, cada producto con su código y su categoría al lado. */
export const PRODUCTOS = GRUPOS.flatMap(g =>
  g.items.map(([codigo, nombre]) => ({ codigo, nombre, cat: g.cat, icono: g.icono }))
);

const POR_NOMBRE = new Map(PRODUCTOS.map(p => [normalizar(p.nombre), p]));

/** El código de la lista de precios, o "" si el producto no tiene. */
export function codigoDe(nombre) {
  const p = POR_NOMBRE.get(normalizar(nombre));
  return p ? p.codigo : "";
}

const INDICE = PRODUCTOS.map(p => ({ ...p, norm: normalizar(p.nombre) }));

/**
 * Busca por palabras sueltas y en cualquier orden: "frank 20" cae en
 * "Salchicha tipo Frankfurt x 20", que es como lo dicta un vendedor.
 * También busca por código, que es como lo pide el cliente que tiene la
 * lista de precios en la mano: "520" trae el Jamón Cocido Feteado.
 * Primero el código exacto, después lo que empieza con lo tipeado.
 */
export function buscarProductos(texto, limite = 40) {
  const q = normalizar(texto);
  if (!q) return INDICE.slice(0, limite);
  const palabras = q.split(" ").filter(Boolean);
  const hits = INDICE.filter(p =>
    palabras.every(w => p.norm.includes(w) || (p.codigo && p.codigo.startsWith(w)))
  );
  hits.sort((a, b) => {
    // El código cantado entero manda: si tipeó "05" quiere el 05, no el 050.
    const ac = a.codigo === q ? 0 : 1;
    const bc = b.codigo === q ? 0 : 1;
    const ap = a.norm.startsWith(palabras[0]) ? 0 : 1;
    const bp = b.norm.startsWith(palabras[0]) ? 0 : 1;
    return ac - bc || ap - bp || a.norm.length - b.norm.length;
  });
  return hits.slice(0, limite);
}

/** ¿Es un producto del catálogo o algo escrito a mano? */
export function esDelCatalogo(nombre) {
  return POR_NOMBRE.has(normalizar(nombre));
}

// ── Los últimos que usó este vendedor ────────────────────────
// La mayoría repite los mismos seis o siete productos; que los tenga arriba
// ahorra el 90% de las búsquedas. Vive en el navegador, no en la base.
const LLAVE_RECIENTES = "munich-productos-recientes";
const MAX_RECIENTES = 8;

export function productosRecientes() {
  try {
    const raw = JSON.parse(localStorage.getItem(LLAVE_RECIENTES) || "[]");
    if (!Array.isArray(raw)) return [];
    // Un producto que cambió de nombre en la lista de precios quedó viejo en
    // el localStorage: si ya no existe se cae solo, en vez de ofrecerse.
    return raw.filter(x => typeof x === "string" && esDelCatalogo(x)).slice(0, MAX_RECIENTES);
  } catch { return []; }
}

export function recordarProducto(nombre) {
  if (!nombre || !esDelCatalogo(nombre)) return;
  try {
    const prev = productosRecientes().filter(x => normalizar(x) !== normalizar(nombre));
    localStorage.setItem(LLAVE_RECIENTES, JSON.stringify([nombre, ...prev].slice(0, MAX_RECIENTES)));
  } catch { /* modo privado, sin drama */ }
}
