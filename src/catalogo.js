// ── Catálogo de productos ────────────────────────────────────
// Los vendedores tipeaban el nombre de cada producto a mano en el pedido:
// salían diez formas distintas de escribir "Knackwurst" y después no había
// manera de sumar cuánto se vendió de cada cosa. Esta es la lista oficial;
// el buscador del formulario come de acá.
//
// Se puede seguir escribiendo libre (hay productos nuevos, promos, cosas
// puntuales), pero lo que está en la lista se elige de un toque.

export const CATALOGO = [
  {
    cat: "Salchichas",
    icono: "🌭",
    items: [
      "Salchicha Knackwurst (Chorizo Alemán) x 3",
      "Salchicha Knackwurst (Chorizo Alemán) x 12",
      "Salchicha Knackwurst (Chorizo Alemán) x 50",
      "Salchicha tipo Viena x 3",
      "Salchicha tipo Viena x 5",
      "Salchicha tipo Viena x 18",
      "Salchicha tipo Frankfurt x 3",
      "Salchicha tipo Frankfurt x 5",
      "Salchicha tipo Frankfurt x 20",
      "Salchicha tipo Frankfurt x 50",
      "Salchicha Hungara x 3",
      "Salchicha Hungara x 18",
      "Salchicha Weisswurst (Chorizo blanco) x 3",
      "Salchicha Weisswurst (Chorizo blanco) x 12",
      "Salchicha Bratwurst x 3",
      "Salchicha Bratwurst x 50 aprox.",
      "Salchicha Ogianco x 6 unid 0,200 gr (10 cm)",
      "Salchicha Ogianco x 50 unid (10 cm)",
      "Salchicha Ogianco x 5 unid 0,400 gr (23 cm)",
      "Salchicha Ogianco x 50 unid (23 cm)",
    ],
  },
  {
    cat: "Copetín y roscas",
    icono: "🥨",
    items: [
      "Rosca Polaca",
      "Copetin Viena",
      "Copetin Viena a Granel (Aprox. 3 kg)",
      "Copetin Hungaro",
      "Copetin Hungaro a Granel (Aprox. 3 Kg)",
    ],
  },
  {
    cat: "Salames y embutidos",
    icono: "🍖",
    items: [
      "Salchichon Ahumado",
      "Leberwurst",
      "Leberwurst (Fraccion)",
      "Leberwurst (Plancha)",
      "Holstein (salame ahumado picado fino)",
      "Holstein (Fraccion)",
      "Holstein (Plancha)",
      "Alpino (salame ahumado picado grueso)",
      "Alpino (Fraccion)",
      "Alpino (Plancha)",
      "Cracovia para Fetear",
      "Cracovia Fina",
      "Cracovia Fina (Fraccion)",
      "Cracovia Fina (Plancha)",
      "Leberkase",
      "Salame tipo colonia",
      "Salame tipo colonia envasado al vacío",
      "Pepperoni",
    ],
  },
  {
    cat: "Cerdo y ahumados",
    icono: "🐖",
    items: [
      "Lomo de cerdo Ahumado",
      "Lomo de Cerdo Ahumado (Fraccion)",
      "Lomo de Cerdo a las Finas Hierbas",
      "Lomo de Cerdo a las Finas Hierbas (Fracc)",
      "Panceta ahumada",
      "Panceta (Fraccion)",
      "Karre de Cerdo ahumado",
      "Kassler (costeletitas de Cerdo)",
      "Kassler x 2 unidades",
      "Bondiola envasada al vacio",
      "Bondiola (Fraccion)",
    ],
  },
  {
    cat: "Jamones y arrollados",
    icono: "🍗",
    items: [
      "Jamon Asado (Media Pieza)",
      "Jamon cocido Natural con cuero",
      "Jamon Bavaro",
      "Matambre Arrollado",
      "Matambre Arrollado (Fraccion)",
      "Arrollado de Pollo",
      "Arrollado de Pollo (Fraccion)",
      "Arrollado Criollo",
      "Arrollado Criollo (Fraccion)",
    ],
  },
  {
    cat: "Feteados",
    icono: "🔪",
    items: [
      "Jamón Cocido (Feteado)",
      "Bondiola (Feteado)",
      "Arrollado de Pollo (Feteado)",
      "Arrollado Criollo (Feteado)",
      "Jamón tipo Asado (Feteado)",
      "Jamón Bávaro (Feteado)",
      "Panceta Ahumada (Feteado)",
      "Lomo de Cerdo Ahumado (Feteado)",
      "Lomo de Cerdo a las Finas Hierbas (Feteado)",
    ],
  },
  {
    cat: "Cajas y picadas",
    icono: "🎁",
    items: [
      "Caja de Regalo (Incluye 5 Productos Fracción)",
      "Caja de Madera (Incluye 7 Productos)",
      "Picada envasada al vacío",
    ],
  },
];

/** La lista plana, cada producto con su categoría al lado. */
export const PRODUCTOS = CATALOGO.flatMap(g =>
  g.items.map(nombre => ({ nombre, cat: g.cat, icono: g.icono }))
);

/** Sin tildes, sin mayúsculas: así "jamon bavaro" encuentra "Jamón Bávaro". */
export function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const INDICE = PRODUCTOS.map(p => ({ ...p, norm: normalizar(p.nombre) }));

/**
 * Busca por palabras sueltas y en cualquier orden: "frank 20" cae en
 * "Salchicha tipo Frankfurt x 20", que es como lo dicta un vendedor.
 * Primero los que empiezan con lo tipeado, después el resto.
 */
export function buscarProductos(texto, limite = 40) {
  const q = normalizar(texto);
  if (!q) return INDICE.slice(0, limite);
  const palabras = q.split(" ").filter(Boolean);
  const hits = INDICE.filter(p => palabras.every(w => p.norm.includes(w)));
  hits.sort((a, b) => {
    const ap = a.norm.startsWith(palabras[0]) ? 0 : 1;
    const bp = b.norm.startsWith(palabras[0]) ? 0 : 1;
    return ap - bp || a.norm.length - b.norm.length;
  });
  return hits.slice(0, limite);
}

/** ¿Es un producto del catálogo o algo escrito a mano? */
export function esDelCatalogo(nombre) {
  const n = normalizar(nombre);
  return INDICE.some(p => p.norm === n);
}

// ── Los últimos que usó este vendedor ────────────────────────
// La mayoría repite los mismos seis o siete productos; que los tenga arriba
// ahorra el 90% de las búsquedas. Vive en el navegador, no en la base.
const LLAVE_RECIENTES = "munich-productos-recientes";
const MAX_RECIENTES = 8;

export function productosRecientes() {
  try {
    const raw = JSON.parse(localStorage.getItem(LLAVE_RECIENTES) || "[]");
    return Array.isArray(raw) ? raw.filter(x => typeof x === "string").slice(0, MAX_RECIENTES) : [];
  } catch { return []; }
}

export function recordarProducto(nombre) {
  if (!nombre || !esDelCatalogo(nombre)) return;
  try {
    const prev = productosRecientes().filter(x => normalizar(x) !== normalizar(nombre));
    localStorage.setItem(LLAVE_RECIENTES, JSON.stringify([nombre, ...prev].slice(0, MAX_RECIENTES)));
  } catch { /* modo privado, sin drama */ }
}
