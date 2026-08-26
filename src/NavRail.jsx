import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MessageSquare, UserCheck, Package, CalendarCheck, Users,
  BarChart2, Settings, Shield, LogOut, PanelLeftClose, PanelLeftOpen, MoreHorizontal, X, MessageCircle, Megaphone, Lock, StickyNote,
} from "lucide-react";
import { C, LOGO_URL, LOGO_VIDEO_URL, FONT_DISPLAY, FONT_BODY, getIdentidadInterna, marketingHabilitado } from "./lib";
import { PanelMensajeria, useUnreadInternos } from "./MensajeriaInterna";

// ============================================================
// NAV RAIL — barra lateral de navegación estilo CRM moderno.
// Colapsada muestra sólo iconos; se expande al pasar el mouse
// (o queda fijada con el pin) sin empujar el contenido.
// ============================================================

const W_MINI = 76;   // ancho colapsado (y ancho de la "columna" de iconos)
const W_OPEN = 246;  // ancho expandido

const RAIL = {
  bg:    "linear-gradient(185deg,#1B1E24 0%,#121419 55%,#0C0E12 100%)",
  line:  "rgba(255,255,255,.07)",
  idle:  "#9AA2B0",
  text:  "#EDEFF3",
  dim:   "rgba(255,255,255,.38)",
};

const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 };

// ── Glow del ítem activo ────────────────────────────────────
// Un anillo de 1px con degradé que gira despacio, apenas visible, detrás
// del fondo rojo del ítem seleccionado. La idea es que se perciba como un
// detalle y no como una animación: si llama la atención, está mal.
//
// Es blanco sobre gris, no de color: el destello blanco se distingue del
// fondo oscuro del menú y también del rojo del botón. Con tonos rojizos la
// sombra del propio botón se lo comía.
//
// Dos perillas para ajustarlo sin tocar nada más:
//   --mn-glow-opacidad  cuánto se ve  (0.35 discreto · 0.6 marcado)
//   --mn-glow-blur      qué tan difuso (2px anillo nítido · 6px halo)
const GLOW_CSS = `
@property --mn-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.mn-glow {
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
  --mn-glow-opacidad: .9;
  --mn-glow-blur: 2px;
}

.mn-glow::before {
  content: "";
  position: absolute;
  /* Separado 3px: pegado al botón se lo comía su propia sombra roja. */
  inset: -3px;
  border-radius: inherit;
  padding: 1px;
  /* Un anillo gris tenue siempre visible, y un destello blanco que da la
     vuelta. El blanco es lo único que se distingue tanto del fondo oscuro
     del menú como del rojo del botón: con tonos rojizos, el propio botón
     se lo comía. */
  background: conic-gradient(
    from var(--mn-angle, 0deg),
    rgba(255,255,255,.10) 0%,
    rgba(255,255,255,.10) 14%,
    rgba(255,255,255,.55) 22%,
    rgba(255,255,255,.95) 26%,
    rgba(255,255,255,.45) 31%,
    rgba(255,255,255,.10) 42%,
    rgba(255,255,255,.10) 100%
  );
  /* Deja sólo el borde: el relleno se recorta y queda el anillo de 1px. */
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
  opacity: var(--mn-glow-opacidad);
  filter: blur(var(--mn-glow-blur));
  animation: mn-girar-glow 9s linear infinite;
}

@keyframes mn-girar-glow { to { --mn-angle: 360deg; } }

/* Si el sistema pide menos movimiento, el anillo se queda quieto pero se ve. */
@media (prefers-reduced-motion: reduce) {
  .mn-glow::before { animation: none; }
}
`;

/**
 * Anillo para marcar algo como seleccionado. Reutilizable: se le pasan las
 * mismas medidas que tenga el fondo al que acompaña.
 *
 * Va ANTES del fondo en el orden del DOM, así queda por detrás sin pelearse
 * con los z-index del icono y la etiqueta.
 */
function GlowActivo({ inset, radio }) {
  return <span className="mn-glow" style={{ inset, borderRadius: radio }} />;
}


// El chat interno no es una vista: abre su propio panel flotante.
const ITEM_MENSAJES = { key: "mensajes", icon: MessageCircle, label: "Mensajes", panel: true };

// Ítems de navegación agrupados en secciones
function getSecciones(rol) {
  const principal = [
    { key: "chat",       icon: MessageSquare,  label: "Chats" },
    { key: "vendedores", icon: UserCheck,      label: "Vendedores" },
    { key: "pedidos",    icon: Package,        label: "Pedidos" },
    ITEM_MENSAJES,
  ];
  const gestion = [
    { key: "calendario", icon: CalendarCheck,  label: "Calendario" },
    { key: "notas",      icon: StickyNote,     label: "Notas" },
    { key: "contactos",  icon: Users,          label: "Contactos" },
    // Mandar a toda la base es irreversible: la pestaña es solo de Cristian.
    ...(rol === "admin" ? [{ key: "marketing", icon: Megaphone, label: "Marketing", bloqueado: !marketingHabilitado() }] : []),
    { key: "reportes",   icon: BarChart2,      label: "Reportes" },
  ];
  const sistema = [
    { key: "ajustes",    icon: Settings,       label: "Ajustes" },
    ...(rol === "admin" ? [{ key: "admin", icon: Shield, label: "Admin" }] : []),
  ];

  // Administración: chats, pedidos, mensajes internos y calendario (recordatorios)
  if (rol === "administracion") {
    return [{
      titulo: null,
      items: [
        ...principal.filter(i => i.key !== "vendedores"),
        { key: "calendario", icon: CalendarCheck, label: "Calendario" },
        { key: "notas",      icon: StickyNote,    label: "Notas" },
      ],
    }];
  }
  return [
    { titulo: "Principal", items: principal },
    { titulo: "Gestión",   items: gestion },
    { titulo: "Sistema",   items: sistema },
  ];
}

// ── Píldora de notificación ──
function Badge({ n, tono = "verde" }) {
  if (!n) return null;
  const bg = tono === "verde" ? "#22C55E" : C.red;
  return (
    <motion.span
      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}
      style={{
        position: "absolute", top: -5, right: -8, background: bg, color: "#fff",
        fontSize: 9.5, fontWeight: 800, fontFamily: FONT_BODY, borderRadius: 99,
        minWidth: 17, height: 17, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 5px", border: "2px solid #14161B",
        lineHeight: 1, whiteSpace: "nowrap",
      }}>
      {/* El número real. Antes cortaba en "99+", que en un CRM con muchos
          mensajes sin leer no dice nada: 100 y 400 se veían igual.
          El tope pasa a 999 sólo para que no se desarme la píldora. */}
      {n > 999 ? "999+" : n}
    </motion.span>
  );
}

// ── Ítem del rail ──
function RailItem({ item, activo, expandido, badge, onClick }) {
  const [hover, setHover] = useState(false);
  const Icon = item.icon;

  return (
    <div style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <motion.button onClick={item.bloqueado ? undefined : onClick}
        disabled={item.bloqueado}
        title={item.bloqueado ? "Todavía no está habilitado" : undefined}
        whileTap={item.bloqueado ? undefined : { scale: 0.965 }}
        style={{
          position: "relative", width: "100%", height: 46, display: "flex",
          alignItems: "center", background: "transparent", border: "none",
          cursor: item.bloqueado ? "not-allowed" : "pointer", padding: 0, textAlign: "left",
          opacity: item.bloqueado ? 0.42 : 1,
          color: activo ? "#fff" : hover ? RAIL.text : RAIL.idle,
          transition: "color .18s ease",
        }}>

        {/* Glow del seleccionado: va primero para quedar por detrás del fondo */}
        {activo && !item.bloqueado && <GlowActivo inset="3px 12px" radio={13} />}

        {/* Fondo activo — se desliza entre ítems */}
        {activo && (
          <motion.span layoutId="rail-activo" transition={SPRING}
            style={{
              position: "absolute", inset: "3px 12px", borderRadius: 13,
              background: "linear-gradient(102deg, rgba(190,38,38,.95), rgba(127,20,20,.78))",
              boxShadow: "0 10px 24px rgba(168,31,31,.38), inset 0 1px 0 rgba(255,255,255,.22)",
            }} />
        )}
        {/* Fondo hover */}
        {!activo && hover && !item.bloqueado && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }}
            style={{ position: "absolute", inset: "3px 12px", borderRadius: 13, background: "rgba(255,255,255,.065)" }} />
        )}

        {/* Icono */}
        <span style={{ position: "relative", width: W_MINI, flexShrink: 0, display: "flex", justifyContent: "center", zIndex: 1 }}>
          <motion.span animate={{ scale: hover && !activo ? 1.14 : 1 }} transition={SPRING}
            style={{ position: "relative", display: "flex" }}>
            <Icon size={19} strokeWidth={activo ? 2.4 : 1.9} />
            <Badge n={badge} tono={item.key === "chat" || item.key === "mensajes" ? "verde" : "rojo"} />
          </motion.span>
        </span>

        {/* Etiqueta */}
        <motion.span
          animate={{ opacity: expandido ? 1 : 0, x: expandido ? 0 : -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            position: "relative", zIndex: 1, whiteSpace: "nowrap", fontFamily: FONT_DISPLAY,
            fontWeight: 650, fontSize: 13.5, letterSpacing: 0.2, pointerEvents: "none",
          }}>
          {item.label}
          {item.bloqueado && <Lock size={11} style={{ marginLeft: 6, verticalAlign: "-1px" }} />}
        </motion.span>
      </motion.button>

      {/* Tooltip cuando está colapsado */}
      <AnimatePresence>
        {!expandido && hover && (
          <motion.span
            initial={{ opacity: 0, x: -6, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.94 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", left: W_MINI - 8, top: "50%", translateY: "-50%",
              background: "#22252C", color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 650,
              fontSize: 12.5, padding: "7px 12px", borderRadius: 9, whiteSpace: "nowrap",
              boxShadow: "0 12px 30px rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.09)",
              pointerEvents: "none", zIndex: 300,
            }}>
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// RAIL (desktop)
// ============================================================
export default function NavRail({ vista, setVista, rol, userName, userEmail, onLogout, badges = {} }) {
  const [pin, setPin]     = useState(() => localStorage.getItem("munich-rail-pin") === "1");
  const [hover, setHover] = useState(false);
  const [videoOk, setVideoOk] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const expandido = pin || hover;

  const identidad = getIdentidadInterna(userEmail);
  const [unread, recargarUnread] = useUnreadInternos(identidad.key, "rail");

  useEffect(() => { localStorage.setItem("munich-rail-pin", pin ? "1" : "0"); }, [pin]);

  const secciones = getSecciones(rol);

  return (
    <>
    {/* El hueco en el flujo crece sólo cuando el rail está fijado */}
    <motion.div animate={{ width: pin ? W_OPEN : W_MINI }} transition={SPRING}
      style={{ flexShrink: 0, height: "100%", position: "relative", zIndex: 60 }}>
      <style>{GLOW_CSS}</style>
      <motion.nav
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        animate={{ width: expandido ? W_OPEN : W_MINI }} transition={SPRING}
        style={{
          position: "absolute", top: 0, left: 0, height: "100%", overflow: "hidden",
          background: RAIL.bg, display: "flex", flexDirection: "column",
          borderRight: "1px solid rgba(0,0,0,.35)",
          boxShadow: expandido && !pin ? "22px 0 60px rgba(8,10,14,.35)" : "0 0 0 rgba(0,0,0,0)",
        }}>

        {/* Brillo sutil en el borde derecho */}
        <span style={{ position: "absolute", top: 0, right: 0, width: 1, height: "100%", background: "linear-gradient(180deg, rgba(255,255,255,.10), transparent 45%, rgba(168,31,31,.35))" }} />

        {/* ── Marca ── */}
        <motion.div animate={{ width: expandido ? W_OPEN : W_MINI }} transition={SPRING}
          style={{
            height: 86, overflow: "hidden", position: "relative", flexShrink: 0,
            background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,.28)",
          }}>
            {/* Logo fijo mientras está colapsado (el video se recortaría) */}
            <img src={LOGO_URL} alt="Nuevo Munich"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 6 }} />

            {/* El video sólo corre con el menú desplegado, y arranca desde cero */}
            <AnimatePresence>
              {expandido && videoOk && !reduceMotion && (
                <motion.video key="marca-video"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  src={LOGO_VIDEO_URL} autoPlay muted loop playsInline preload="auto"
                  onError={() => setVideoOk(false)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
            </AnimatePresence>
        </motion.div>

        {/* ── Navegación ── */}
        <div className="strip" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 0" }}>
          {secciones.map((sec, i) => (
            <div key={sec.titulo || i} style={{ marginBottom: 10 }}>
              {sec.titulo && (
                <motion.div animate={{ opacity: expandido ? 1 : 0 }} transition={{ duration: 0.15 }}
                  style={{
                    height: 22, display: "flex", alignItems: "center", paddingLeft: 26,
                    color: RAIL.dim, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.6,
                    textTransform: "uppercase", fontFamily: FONT_DISPLAY, whiteSpace: "nowrap", pointerEvents: "none",
                  }}>
                  {sec.titulo}
                </motion.div>
              )}
              {sec.items.map((item) => (
                <RailItem key={item.key} item={item}
                  activo={item.panel ? msgOpen : vista === item.key}
                  expandido={expandido}
                  badge={item.key === "mensajes" ? unread : badges[item.key]}
                  onClick={() => (item.panel ? setMsgOpen(true) : setVista(item.key))} />
              ))}
            </div>
          ))}
        </div>

        {/* ── Usuario ── */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${RAIL.line}`, padding: "10px 0 8px" }}>
          <div style={{ display: "flex", alignItems: "center", height: 46 }}>
            <div style={{ width: W_MINI, flexShrink: 0, display: "flex", justifyContent: "center" }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center",
                background: "linear-gradient(140deg,#3A3F4A,#22252C)", color: "#fff",
                border: "1px solid rgba(255,255,255,.14)", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5,
              }}>
                {(userName || "U")[0].toUpperCase()}
              </div>
            </div>
            <motion.div animate={{ opacity: expandido ? 1 : 0, x: expandido ? 0 : -10 }}
              transition={{ duration: 0.18 }}
              style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ color: RAIL.text, fontSize: 13, fontWeight: 700, textOverflow: "ellipsis", overflow: "hidden" }}>{userName}</div>
              <div style={{ color: RAIL.dim, fontSize: 10.5, textOverflow: "ellipsis", overflow: "hidden" }}>{userEmail}</div>
            </motion.div>
            <motion.button onClick={onLogout} title="Cerrar sesión"
              animate={{ opacity: expandido ? 1 : 0 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
              style={{
                marginRight: 14, flexShrink: 0, width: 32, height: 32, borderRadius: 9, cursor: "pointer",
                background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                color: RAIL.idle, display: "grid", placeItems: "center",
                pointerEvents: expandido ? "auto" : "none",
              }}>
              <LogOut size={15} />
            </motion.button>
          </div>

          {/* Pin: fija el rail abierto */}
          <button onClick={() => setPin(v => !v)} title={pin ? "Contraer menú" : "Fijar menú abierto"}
            style={{
              marginTop: 4, width: "100%", height: 34, display: "flex", alignItems: "center",
              background: "transparent", border: "none", cursor: "pointer", padding: 0, color: RAIL.dim,
            }}>
            <span style={{ width: W_MINI, display: "flex", justifyContent: "center", flexShrink: 0 }}>
              {pin ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </span>
            <motion.span animate={{ opacity: expandido ? 1 : 0, x: expandido ? 0 : -10 }}
              transition={{ duration: 0.18 }}
              style={{ fontSize: 11.5, fontFamily: FONT_DISPLAY, fontWeight: 650, letterSpacing: 0.4, whiteSpace: "nowrap", pointerEvents: "none" }}>
              {pin ? "Contraer menú" : "Fijar menú"}
            </motion.span>
          </button>
        </div>
      </motion.nav>
    </motion.div>

    {/* Chat interno — se abre desde el ítem "Mensajes" del menú */}
    {msgOpen && (
      <PanelMensajeria self={identidad}
        onClose={() => { setMsgOpen(false); recargarUnread(); }}
        onLeer={recargarUnread} />
    )}
    </>
  );
}

// ============================================================
// NAV MOBILE — barra inferior + hoja "Más"
// ============================================================
export function NavMobile({ vista, setVista, rol, userName, onLogout, badges = {} }) {
  const [sheet, setSheet] = useState(false);
  const secciones = getSecciones(rol);
  // En mobile el chat interno sigue en el botón de la cabecera
  const todos = secciones.flatMap(s => s.items).filter(i => !i.panel);
  const principales = todos.slice(0, 4);
  const resto = todos.slice(4);
  const enResto = resto.some(i => i.key === vista);

  return (
    <>
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90,
        display: "flex", alignItems: "stretch",
        background: RAIL.bg, borderTop: "1px solid rgba(0,0,0,.4)",
        boxShadow: "0 -12px 34px rgba(8,10,14,.35)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {principales.map((item) => {
          const Icon = item.icon;
          const activo = vista === item.key;
          return (
            <motion.button key={item.key} whileTap={item.bloqueado ? undefined : { scale: 0.92 }}
              onClick={item.bloqueado ? undefined : () => setVista(item.key)}
              disabled={item.bloqueado}
              style={{
                flex: 1, position: "relative", height: 60, background: "transparent", border: "none",
                cursor: item.bloqueado ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 4, color: activo ? "#fff" : RAIL.idle,
                opacity: item.bloqueado ? 0.4 : 1,
              }}>
              {activo && (
                <motion.span layoutId="nav-mobile-activo" transition={SPRING}
                  style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 3, borderRadius: "0 0 4px 4px", background: "#D93B3B", boxShadow: "0 4px 16px rgba(217,59,59,.7)" }} />
              )}
              <span style={{ position: "relative", display: "flex" }}>
                <Icon size={19} strokeWidth={activo ? 2.4 : 1.9} />
                <Badge n={badges[item.key]} tono={item.key === "chat" ? "verde" : "rojo"} />
              </span>
              <span style={{ fontSize: 9.5, fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{item.label}</span>
            </motion.button>
          );
        })}

        {resto.length > 0 && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => setSheet(true)}
            style={{
              flex: 1, height: 60, background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 4, color: enResto ? "#fff" : RAIL.idle,
            }}>
            <MoreHorizontal size={19} strokeWidth={enResto ? 2.4 : 1.9} />
            <span style={{ fontSize: 9.5, fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Más</span>
          </motion.button>
        )}
      </nav>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheet(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,.55)", backdropFilter: "blur(3px)", zIndex: 95 }} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={SPRING}
              style={{
                position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 96,
                background: RAIL.bg, borderRadius: "20px 20px 0 0", padding: "10px 12px 22px",
                boxShadow: "0 -20px 50px rgba(8,10,14,.5)", paddingBottom: "calc(22px + env(safe-area-inset-bottom))",
              }}>
              <div style={{ width: 42, height: 4, borderRadius: 99, background: "rgba(255,255,255,.18)", margin: "4px auto 12px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 10px" }}>
                <span style={{ color: RAIL.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", fontFamily: FONT_DISPLAY }}>{userName}</span>
                <button onClick={() => setSheet(false)} style={{ background: "transparent", border: "none", color: RAIL.idle, cursor: "pointer", display: "flex" }}><X size={18} /></button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {resto.map((item) => {
                  const Icon = item.icon;
                  const activo = vista === item.key;
                  return (
                    <motion.button key={item.key} whileTap={item.bloqueado ? undefined : { scale: 0.94 }}
                      onClick={item.bloqueado ? undefined : () => { setVista(item.key); setSheet(false); }}
                      disabled={item.bloqueado}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 8, padding: "16px 6px", borderRadius: 14, cursor: item.bloqueado ? "not-allowed" : "pointer",
                        opacity: item.bloqueado ? 0.4 : 1,
                        border: `1px solid ${activo ? "rgba(217,59,59,.55)" : "rgba(255,255,255,.08)"}`,
                        background: activo ? "linear-gradient(140deg,rgba(190,38,38,.9),rgba(127,20,20,.7))" : "rgba(255,255,255,.04)",
                        color: activo ? "#fff" : RAIL.text,
                      }}>
                      <Icon size={20} strokeWidth={1.9} />
                      <span style={{ fontSize: 11, fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.3 }}>
                        {item.label}{item.bloqueado && <Lock size={10} style={{ marginLeft: 4, verticalAlign: "-1px" }} />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <button onClick={onLogout}
                style={{
                  marginTop: 12, width: "100%", height: 46, borderRadius: 13, cursor: "pointer",
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)",
                  color: "#F2B8B8", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <LogOut size={16} /> Cerrar sesión
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
