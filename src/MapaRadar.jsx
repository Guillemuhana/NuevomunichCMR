import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Radar } from "lucide-react";

// Mapa decorativo de la cabecera de Clientes potenciales: un radar que
// barre un plano de calles y va "encontrando" negocios. No es un mapa
// real (no gasta nada de Google): acompaña lo que pasa en la búsqueda.
// Mientras busca, el radar acelera; con resultados, muestra el conteo.

const ANCHO = 400;
const ALTO = 190;
const CENTRO = { x: 196, y: 98 };

// Negocios de muestra, en orden de recorrido.
const PINES = [
  { x: 118, y: 62,  p: "ALTA" },
  { x: 164, y: 138, p: "MEDIA" },
  { x: 250, y: 150, p: "ALTA" },
  { x: 318, y: 112, p: "BAJA" },
  { x: 290, y: 46,  p: "ALTA" },
  { x: 62,  y: 128, p: "MEDIA" },
];
const COLOR = { ALTA: "#ef4444", MEDIA: "#f59e0b", BAJA: "#22c55e" };

const CALLES = [
  "M-10 40 C 80 30, 160 52, 410 36",
  "M-10 118 C 90 108, 210 128, 410 104",
  "M-10 170 C 120 160, 260 182, 410 166",
  "M40 -10 C 52 60, 30 130, 46 200",
  "M140 -10 C 128 70, 150 130, 136 200",
  "M236 -10 C 246 60, 226 140, 240 200",
  "M340 -10 C 330 70, 352 130, 338 200",
];
const AVENIDAS = [
  "M-10 200 L 410 -10",
  "M-10 76 C 120 90, 280 60, 410 80",
];
const RIO = "M-10 20 C 60 60, 110 12, 180 30 S 300 90, 410 58";
const RUTA = `M${CENTRO.x} ${CENTRO.y} ` + PINES.map((p) => `L${p.x} ${p.y}`).join(" ");

export default function MapaRadar({ zona, cargando, cantidad }) {
  const quieto = useReducedMotion();
  const [vuelta, setVuelta] = useState(0);

  // Cada tanto se "reencuentran" los negocios para que el mapa respire.
  useEffect(() => {
    if (quieto) return;
    const t = setInterval(() => setVuelta((v) => v + 1), cargando ? 2600 : 7000);
    return () => clearInterval(t);
  }, [cargando, quieto]);

  // Inclinación 3D siguiendo el mouse.
  const rx = useSpring(useMotionValue(0), { stiffness: 140, damping: 16 });
  const ry = useSpring(useMotionValue(0), { stiffness: 140, damping: 16 });
  const mover = (e) => {
    if (quieto) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const soltar = () => { rx.set(0); ry.set(0); };

  const hayResultados = !cargando && cantidad > 0;
  const titulo = cargando ? `Rastreando ${zona}…` : hayResultados ? `${cantidad} negocios en ${zona}` : `Radar listo · ${zona}`;

  return (
    <motion.div
      className="mapa-radar"
      aria-hidden="true"
      onMouseMove={mover}
      onMouseLeave={soltar}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMid slice" className="mapa-svg">
        <defs>
          <pattern id="mr-puntos" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="rgba(148,163,184,.16)" />
          </pattern>
          <linearGradient id="mr-ruta" x1="0" x2="1">
            <stop offset="0" stopColor="#fca5a5" />
            <stop offset=".6" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#fde68a" />
          </linearGradient>
          <radialGradient id="mr-vineta" cx="50%" cy="50%" r="70%">
            <stop offset="55%" stopColor="#0b1020" stopOpacity="0" />
            <stop offset="100%" stopColor="#0b1020" stopOpacity=".85" />
          </radialGradient>
        </defs>

        <rect width={ANCHO} height={ALTO} fill="url(#mr-puntos)" />
        <path d={RIO} className="mapa-rio" />
        <path d={RIO} className="mapa-rio-flujo" />
        {CALLES.map((d) => <path key={d} d={d} className="mapa-calle" />)}
        {AVENIDAS.map((d) => <path key={d} d={d} className="mapa-avenida" />)}

        {/* Recorrido que se dibuja pin a pin */}
        <path
          key={`ruta-${vuelta}`}
          d={RUTA}
          pathLength="1"
          className="mapa-ruta"
          stroke="url(#mr-ruta)"
          style={{ animationDuration: cargando ? "1.6s" : "3s" }}
        />

        {/* Negocios encontrados */}
        <g key={`pines-${vuelta}`}>
          {PINES.map((pin, i) => (
            <g
              key={i}
              className="mapa-pin"
              style={{ animationDelay: `${0.3 + i * (cargando ? 0.18 : 0.38)}s` }}
            >
              <circle cx={pin.x} cy={pin.y} r="4" fill="none" stroke={COLOR[pin.p]} className="mapa-onda" style={{ animationDelay: `${i * 0.3}s` }} />
              <path
                d={`M${pin.x} ${pin.y + 1} c -5 -6 -7 -9 -7 -12 a 7 7 0 0 1 14 0 c 0 3 -2 6 -7 12 z`}
                fill={COLOR[pin.p]}
                stroke="#fff"
                strokeWidth="1.2"
                style={{ filter: `drop-shadow(0 3px 6px ${COLOR[pin.p]}aa)` }}
              />
              <circle cx={pin.x} cy={pin.y - 11} r="2.4" fill="#fff" />
            </g>
          ))}
        </g>

        {/* Punto de partida del vendedor */}
        <circle cx={CENTRO.x} cy={CENTRO.y} r="5" fill="#38bdf8" stroke="#fff" strokeWidth="1.6" />
        <circle cx={CENTRO.x} cy={CENTRO.y} r="5" fill="none" stroke="#38bdf8" className="mapa-onda mapa-onda-yo" />

        <rect width={ANCHO} height={ALTO} fill="url(#mr-vineta)" />
      </svg>

      {/* Barrido del radar */}
      <div className={`mapa-barrido${cargando ? " rapido" : ""}`} style={{ left: `${(CENTRO.x / ANCHO) * 100}%`, top: `${(CENTRO.y / ALTO) * 100}%` }} />
      <div className="mapa-brillo" />

      <motion.div
        className="mapa-tarjeta"
        key={titulo}
        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45 }}
      >
        <span className={`mapa-tarjeta-icono${cargando ? " girando" : ""}`}><Radar size={13} /></span>
        <span className="mapa-tarjeta-texto">{titulo}</span>
      </motion.div>

      <div className="mapa-leyenda">
        <span><i style={{ background: COLOR.ALTA }} />Alta</span>
        <span><i style={{ background: COLOR.MEDIA }} />Media</span>
        <span><i style={{ background: COLOR.BAJA }} />Baja</span>
      </div>
    </motion.div>
  );
}
