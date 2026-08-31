import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X, Check, Plus, Minus, ChevronDown, ShoppingBag } from "lucide-react";
import { C, L, FONT_BODY, FONT_DISPLAY, UNIDADES, useEsMovil } from "./lib";
import {
  CATALOGO, buscarProductos, normalizar,
  productosRecientes, recordarProducto, esDelCatalogo,
} from "./catalogo";

// ── Elegir productos del catálogo ────────────────────────────
// Antes cada línea del pedido era un campo de texto vacío y el vendedor
// tipeaba el nombre completo del producto, con el celular en una mano y el
// cliente esperando. Salían diez formas de escribir "Knackwurst".
//
// Hay dos maneras de cargar, porque no todos trabajan igual:
//
//   1. SelectorProducto — el campo de cada línea. Se escribe y va filtrando;
//      en el celular se abre como hoja desde abajo, donde el dedo llega.
//   2. CatalogoModal — la lista entera para marcar varios de una y que caigan
//      todos juntos al pedido. Es lo rápido para el pedido grande de siempre.
//
// Ninguna de las dos obliga: un producto que no esté en la lista se sigue
// pudiendo escribir a mano.

/** Resalta en rojo lo que el vendedor tipeó dentro del nombre del producto. */
function Resaltado({ texto, q }) {
  const palabras = normalizar(q).split(" ").filter(Boolean);
  if (!palabras.length) return <>{texto}</>;
  const base = normalizar(texto);
  // normalizar() saca tildes pero no cambia el largo, así que las posiciones
  // del texto normalizado sirven para marcar el original.
  const marcas = new Array(texto.length).fill(false);
  palabras.forEach(w => {
    let desde = 0, i;
    while ((i = base.indexOf(w, desde)) !== -1) {
      for (let k = i; k < i + w.length && k < marcas.length; k++) marcas[k] = true;
      desde = i + w.length;
    }
  });
  const trozos = [];
  let act = "", enMarca = marcas[0];
  for (let i = 0; i < texto.length; i++) {
    if (marcas[i] !== enMarca) { trozos.push({ t: act, m: enMarca }); act = ""; enMarca = marcas[i]; }
    act += texto[i];
  }
  if (act) trozos.push({ t: act, m: enMarca });
  return <>{trozos.map((p, i) => p.m
    ? <b key={i} style={{ color: C.red, fontWeight: 800 }}>{p.t}</b>
    : <span key={i}>{p.t}</span>)}</>;
}

/**
 * Los grupos que se muestran para una búsqueda dada.
 * Con texto: una sola lista por relevancia. Sin texto: los últimos usados
 * arriba y después por categoría, igual que la lista de precios impresa.
 */
function useGrupos(q) {
  return useMemo(() => {
    if (q && q.trim()) {
      return [{ cat: null, icono: null, items: buscarProductos(q, 60).map(r => r.nombre) }];
    }
    const rec = productosRecientes();
    const base = CATALOGO.map(g => ({ cat: g.cat, icono: g.icono, items: g.items }));
    return rec.length
      ? [{ cat: "Usados últimamente", icono: "🕘", items: rec }, ...base]
      : base;
  }, [q]);
}

// ── Campo de producto con buscador ───────────────────────────
export function SelectorProducto({ value, onChange, placeholder = "Elegir producto…", className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(-1);
  const [pos, setPos] = useState(null);
  const anclaRef = useRef(null);
  const listaRef = useRef(null);
  const inputRef = useRef(null);
  const movil = useEsMovil(640);

  const grupos = useGrupos(q);
  const cuantos = useMemo(() => grupos.reduce((s, g) => s + g.items.length, 0), [grupos]);

  const cerrar = useCallback(() => { setAbierto(false); setActivo(-1); }, []);

  // El popover se dibuja fuera del modal (portal) para que el `overflow`
  // del formulario no lo recorte; por eso hay que seguir al campo a mano
  // cuando el formulario scrollea o cambia el tamaño de la ventana.
  const medir = useCallback(() => {
    const el = anclaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const abajo = window.innerHeight - r.bottom;
    const arriba = abajo < 210 && r.top > abajo;
    setPos({
      left: r.left, width: r.width,
      top: arriba ? undefined : r.bottom + 6,
      bottom: arriba ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.min(330, Math.max(160, (arriba ? r.top : abajo) - 14)),
    });
  }, []);

  useEffect(() => {
    if (!abierto || movil) return;
    medir();
    const on = () => medir();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); };
  }, [abierto, movil, medir]);

  useEffect(() => {
    if (!abierto || movil) return;
    const fuera = (e) => {
      if (anclaRef.current && anclaRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest("[data-popover-productos]")) return;
      cerrar();
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, movil, cerrar]);

  // Si lo que hay en el campo ya es un producto de la lista, se abre la lista
  // entera: el vendedor está por cambiarlo, no por afinar la búsqueda.
  const abrir = () => {
    setQ(movil || !value || esDelCatalogo(value) ? "" : value);
    setActivo(-1);
    setAbierto(true);
  };

  const elegir = (nombre) => { onChange(nombre); recordarProducto(nombre); cerrar(); };

  const teclas = (e) => {
    if (e.key === "Escape" && abierto) { e.stopPropagation(); cerrar(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) { abrir(); return; }
      setActivo(a => {
        const n = e.key === "ArrowDown"
          ? Math.min(cuantos - 1, a + 1)
          : Math.max(0, a - 1);
        requestAnimationFrame(() => {
          const el = listaRef.current && listaRef.current.querySelector(`[data-idx="${n}"]`);
          if (el) el.scrollIntoView({ block: "nearest" });
        });
        return n;
      });
      return;
    }
    if (e.key === "Enter" && abierto && activo >= 0) {
      const el = listaRef.current && listaRef.current.querySelector(`[data-idx="${activo}"]`);
      if (el) { e.preventDefault(); el.click(); }
    }
  };

  const campo = {
    width: "100%", padding: "10px 32px 10px 12px", borderRadius: 9,
    border: `1px solid ${value && esDelCatalogo(value) ? "#D8E3D0" : L.border}`,
    fontSize: 13.5, fontFamily: FONT_BODY, color: L.text,
    background: L.white, outline: "none",
  };

  return (
    <div ref={anclaRef} className={className} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {movil ? (
        // Celular: el campo es un botón. Escribir se hace dentro de la hoja,
        // donde el teclado no tapa la lista.
        <button type="button" onClick={abrir}
          style={{ ...campo, textAlign: "left", cursor: "pointer", display: "block",
            color: value ? L.text : L.light, fontWeight: value ? 600 : 400,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {value || placeholder}
        </button>
      ) : (
        <input ref={inputRef} value={value || ""}
          onChange={e => { onChange(e.target.value); setQ(e.target.value); setActivo(-1); setAbierto(true); }}
          onFocus={abrir} onClick={() => { if (!abierto) abrir(); }} onKeyDown={teclas}
          placeholder={placeholder} style={campo} autoComplete="off" />
      )}

      <span onClick={() => {
        if (abierto && !movil) { cerrar(); return; }
        abrir();
        if (!movil && inputRef.current) inputRef.current.focus();
      }}
        style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
          color: L.light, display: "flex", cursor: "pointer", pointerEvents: movil ? "none" : "auto" }}>
        <ChevronDown size={15} style={{ transition: "transform .15s", transform: abierto && !movil ? "rotate(180deg)" : "none" }} />
      </span>

      {/* Escritorio: popover anclado al campo */}
      {abierto && !movil && pos && createPortal(
        <div data-popover-productos style={{
          position: "fixed", left: pos.left, width: pos.width,
          top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight,
          background: L.white, border: `1px solid ${L.border}`, borderRadius: 12,
          boxShadow: "0 16px 44px rgba(16,24,40,.16)", zIndex: 600,
          display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_BODY,
        }}>
          <ListaProductosResaltada grupos={grupos} q={q} activo={activo}
            onElegir={elegir} onHover={setActivo} refLista={listaRef} />
          {value && !esDelCatalogo(value) && (
            <div style={{ padding: "9px 14px", borderTop: `1px solid ${L.border}`, background: L.soft,
              fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 7 }}>
              <Check size={13} color={C.red} style={{ flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Se guarda <strong style={{ color: L.text }}>“{value}”</strong> tal cual lo escribiste
              </span>
            </div>
          )}
        </div>, document.body)}

      {/* Celular: hoja desde abajo */}
      {abierto && movil && createPortal(
        <HojaProducto q={q} setQ={setQ} activo={activo} setActivo={setActivo}
          grupos={grupos} listaRef={listaRef} onCerrar={cerrar} onElegir={elegir} />,
        document.body)}
    </div>
  );
}

/** ListaProductos + resaltado de la búsqueda (necesita saber qué se tipeó). */
function ListaProductosResaltada({ grupos, q, activo, onElegir, onHover, refLista }) {
  const vacio = !grupos.some(g => g.items.length);
  if (vacio) {
    return (
      <div style={{ padding: "26px 18px", textAlign: "center", color: L.light, fontSize: 13, fontFamily: FONT_BODY }}>
        Ningún producto con ese nombre.<br />
        <span style={{ fontSize: 12 }}>Igual podés dejarlo escrito a mano.</span>
      </div>
    );
  }
  let n = -1;
  return (
    <div ref={refLista} className="scroll-y" style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "5px 0" }}>
      {grupos.map((g, gi) => (
        <div key={gi}>
          {g.cat && (
            <div style={{
              position: "sticky", top: 0, zIndex: 1, background: L.white,
              padding: "9px 14px 5px", fontSize: 10.5, fontWeight: 800, color: L.light,
              textTransform: "uppercase", letterSpacing: 0.6, fontFamily: FONT_BODY,
            }}>
              {g.icono} {g.cat}
            </div>
          )}
          {g.items.map(nombre => {
            n++;
            const i = n;
            const sel = i === activo;
            return (
              <button key={`${gi}-${nombre}`} type="button" data-idx={i}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => onHover && onHover(i)}
                onClick={() => onElegir(nombre)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "11px 14px", border: "none", cursor: "pointer",
                  background: sel ? C.redSoft : "transparent",
                  color: L.text, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600,
                  textAlign: "left", lineHeight: 1.3,
                }}>
                <span style={{ flex: 1, minWidth: 0 }}><Resaltado texto={nombre} q={q} /></span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Hoja de selección en celular ─────────────────────────────
function HojaProducto({ q, setQ, activo, setActivo, grupos, listaRef, onCerrar, onElegir }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current && ref.current.focus(), 80);
    return () => clearTimeout(t);
  }, []);
  const libre = q.trim() && !esDelCatalogo(q.trim());
  return (
    <>
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", zIndex: 600 }} />
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 601,
        height: "88dvh", maxHeight: "88vh", background: L.white, borderRadius: "18px 18px 0 0",
        display: "flex", flexDirection: "column", overflow: "hidden",
        fontFamily: FONT_BODY, boxShadow: "0 -10px 40px rgba(0,0,0,.22)",
      }}>
        <div style={{ padding: "10px 14px 12px", borderBottom: `1px solid ${L.border}` }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: L.border, margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <Search size={15} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setActivo(-1); }}
                placeholder="Buscar producto…" inputMode="search"
                style={{ width: "100%", padding: "11px 12px 11px 33px", borderRadius: 10,
                  border: `1px solid ${L.border}`, fontSize: 16, fontFamily: FONT_BODY,
                  outline: "none", background: L.soft, color: L.text }} />
            </div>
            <button onClick={onCerrar}
              style={{ background: L.soft, border: "none", borderRadius: 10, width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, cursor: "pointer", flexShrink: 0 }}>
              <X size={17} />
            </button>
          </div>
        </div>

        <ListaProductosResaltada grupos={grupos} q={q} activo={activo}
          onElegir={onElegir} onHover={setActivo} refLista={listaRef} />

        {libre && (
          <button onClick={() => onElegir(q.trim())}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 16px",
              borderTop: `1px solid ${L.border}`, border: "none", background: L.soft, cursor: "pointer",
              fontFamily: FONT_BODY, fontSize: 13.5, color: L.muted, textAlign: "left" }}>
            <Plus size={16} color={C.red} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Usar <strong style={{ color: L.text }}>“{q.trim()}”</strong> (producto libre)
            </span>
          </button>
        )}
      </div>
    </>
  );
}

// ── Catálogo completo: marcar varios y cargarlos de una ──────
// Para el pedido de siempre: en vez de abrir línea por línea, se recorre la
// lista, se toca lo que va, se ajusta la cantidad y sale todo junto.
export function CatalogoModal({ onAgregar, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(null);
  const [sel, setSel] = useState({});           // nombre -> { qty, unidad }
  const movil = useEsMovil(640);

  const grupos = useMemo(() => {
    if (q.trim()) return [{ cat: null, icono: null, items: buscarProductos(q, 80).map(r => r.nombre) }];
    const base = CATALOGO.filter(g => !cat || g.cat === cat)
      .map(g => ({ cat: g.cat, icono: g.icono, items: g.items }));
    if (cat) return base;
    const rec = productosRecientes();
    return rec.length ? [{ cat: "Usados últimamente", icono: "🕘", items: rec }, ...base] : base;
  }, [q, cat]);

  const elegidos = Object.keys(sel);
  const totalLineas = elegidos.length;

  const toggle = (nombre) => setSel(s => {
    if (s[nombre]) { const n = { ...s }; delete n[nombre]; return n; }
    return { ...s, [nombre]: { qty: 1, unidad: "un" } };
  });
  const cambiarQty = (nombre, delta) => setSel(s => {
    const act = s[nombre];
    if (!act) return s;
    const paso = act.unidad === "kg" ? 0.5 : 1;
    const qty = Math.round((Number(act.qty) + delta * paso) * 100) / 100;
    if (qty <= 0) { const n = { ...s }; delete n[nombre]; return n; }
    return { ...s, [nombre]: { ...act, qty } };
  });
  const cambiarUnidad = (nombre) => setSel(s => {
    const act = s[nombre];
    if (!act) return s;
    const i = UNIDADES.findIndex(u => u.key === (act.unidad || "un"));
    const sig = UNIDADES[(i + 1) % UNIDADES.length];
    return { ...s, [nombre]: { ...act, unidad: sig.key } };
  });

  const confirmar = () => {
    const items = elegidos.map(nombre => {
      recordarProducto(nombre);
      return { qty: sel[nombre].qty, unidad: sel[nombre].unidad, desc: nombre };
    });
    onAgregar(items);
    onClose();
  };

  const chip = (activo) => ({
    padding: "6px 12px", borderRadius: 99, cursor: "pointer", flexShrink: 0,
    border: `1px solid ${activo ? C.red : L.border}`,
    background: activo ? C.redSoft : L.white,
    color: activo ? C.red : L.muted,
    fontSize: 12, fontWeight: 700, fontFamily: FONT_BODY, whiteSpace: "nowrap",
  });

  let n = -1;
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", zIndex: 600 }} />
      <div style={{
        position: "fixed", zIndex: 601, background: L.white, fontFamily: FONT_BODY,
        display: "flex", flexDirection: "column", overflow: "hidden",
        ...(movil
          ? { left: 0, right: 0, bottom: 0, height: "92dvh", maxHeight: "92vh", borderRadius: "18px 18px 0 0" }
          : { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(620px, 94vw)", height: "min(720px, 88vh)", borderRadius: 18 }),
        boxShadow: "0 24px 80px rgba(0,0,0,.25)",
      }}>
        {/* Cabecera */}
        <div style={{ padding: movil ? "10px 14px 12px" : "16px 20px 14px", borderBottom: `1px solid ${L.border}` }}>
          {movil && <div style={{ width: 38, height: 4, borderRadius: 99, background: L.border, margin: "0 auto 12px" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: C.redSoft, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, flexShrink: 0 }}>
              <ShoppingBag size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 15.5, color: L.text }}>Catálogo de productos</div>
              <div style={{ fontSize: 11.5, color: L.light }}>Tocá los que van y ajustá la cantidad</div>
            </div>
            <button onClick={onClose}
              style={{ background: L.soft, border: "none", borderRadius: 9, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: L.muted, cursor: "pointer", flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <Search size={15} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar producto…" inputMode="search"
              style={{ width: "100%", padding: "10px 12px 10px 33px", borderRadius: 10,
                border: `1px solid ${L.border}`, fontSize: movil ? 16 : 13.5, fontFamily: FONT_BODY,
                outline: "none", background: L.soft, color: L.text }} />
          </div>

          {!q.trim() && (
            <div className="strip" style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
              <button onClick={() => setCat(null)} style={chip(!cat)}>Todo</button>
              {CATALOGO.map(g => (
                <button key={g.cat} onClick={() => setCat(cat === g.cat ? null : g.cat)} style={chip(cat === g.cat)}>
                  {g.icono} {g.cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lista con contadores */}
        <div className="scroll-y" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 0" }}>
          {grupos.map((g, gi) => (
            <div key={gi}>
              {g.cat && (
                <div style={{ position: "sticky", top: 0, zIndex: 1, background: L.white,
                  padding: "9px 14px 5px", fontSize: 10.5, fontWeight: 800, color: L.light,
                  textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {g.icono} {g.cat}
                </div>
              )}
              {g.items.map(nombre => {
                n++;
                const s = sel[nombre];
                const un = s ? (UNIDADES.find(u => u.key === s.unidad) || UNIDADES[0]) : null;
                return (
                  <div key={`${gi}-${nombre}`}
                    onClick={() => !s && toggle(nombre)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      cursor: s ? "default" : "pointer",
                      background: s ? C.redSoft : "transparent",
                      borderBottom: `1px solid ${L.soft}`,
                    }}>
                    <span onClick={e => { e.stopPropagation(); toggle(nombre); }}
                      style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                      border: `1.5px solid ${s ? C.red : L.border}`, background: s ? C.red : L.white,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s && <Check size={13} color="#fff" strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: L.text, lineHeight: 1.3 }}>
                      <Resaltado texto={nombre} q={q} />
                    </span>
                    {s && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); cambiarQty(nombre, -1); }} style={btnPaso}>
                          <Minus size={13} />
                        </button>
                        <span style={{ minWidth: 34, textAlign: "center", fontSize: 13, fontWeight: 800, color: L.text }}>
                          {s.qty}
                        </span>
                        <button onClick={e => { e.stopPropagation(); cambiarQty(nombre, 1); }} style={btnPaso}>
                          <Plus size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); cambiarUnidad(nombre); }}
                          title="Cambiar unidad de medida"
                          style={{ ...btnPaso, width: 36, fontSize: 11, fontWeight: 800, color: C.red }}>
                          {un.label}
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {n < 0 && (
            <div style={{ padding: "30px 18px", textAlign: "center", color: L.light, fontSize: 13 }}>
              Ningún producto con ese nombre.
            </div>
          )}
        </div>

        {/* Pie con el resumen */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${L.border}`, display: "flex", alignItems: "center", gap: 10, background: L.white }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: L.muted }}>
            {totalLineas
              ? <><strong style={{ color: L.text }}>{totalLineas}</strong> producto{totalLineas > 1 ? "s" : ""} elegido{totalLineas > 1 ? "s" : ""}</>
              : "Todavía no elegiste nada"}
          </div>
          <button onClick={confirmar} disabled={!totalLineas}
            style={{
              background: totalLineas ? C.red : L.border, color: totalLineas ? "#fff" : L.light,
              border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 13.5,
              fontFamily: FONT_DISPLAY, fontWeight: 700, cursor: totalLineas ? "pointer" : "default",
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
            }}>
            <Plus size={15} /> Agregar al pedido
          </button>
        </div>
      </div>
    </>, document.body);
}

const btnPaso = {
  width: 28, height: 28, borderRadius: 8, border: `1px solid ${L.border}`,
  background: L.white, color: L.muted, cursor: "pointer", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};
