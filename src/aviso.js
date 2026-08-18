// ============================================================
// Avisos sonoros
// ------------------------------------------------------------
// Hace sonar el celular (y la compu) cuando entra un mensaje de
// un cliente, un mensaje interno o un pedido nuevo, con la app
// abierta. Cuando la app está cerrada eso lo cubren las push de
// Firebase; esto es para el rato en que la estás mirando.
//
// El sonido se genera con Web Audio, no es un archivo: así no hay
// que recompilar el APK ni pedir nada por la red para que suene.
// ============================================================

const CLAVE_PREF = "munich-avisos-sonido";

let ctx = null;
const recientes = new Map();   // clave -> timestamp, para no avisar dos veces

/** ¿El usuario quiere que suene? Por defecto sí. */
export function sonidoActivado() {
  try { return localStorage.getItem(CLAVE_PREF) !== "0"; } catch { return true; }
}

export function setSonidoActivado(valor) {
  try { localStorage.setItem(CLAVE_PREF, valor ? "1" : "0"); } catch { /* modo privado */ }
}

/**
 * Los navegadores no dejan sonar nada hasta que la persona toca la pantalla.
 * Enganchamos el primer toque o tecla para dejar el audio listo.
 */
export function prepararAudio() {
  if (typeof window === "undefined") return;
  const abrir = () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch { /* sin audio disponible */ }
  };
  window.addEventListener("pointerdown", abrir, { once: true });
  window.addEventListener("keydown", abrir, { once: true });
}

/** Dos notas cortas, tipo campanita. `grave` para lo menos urgente. */
function campanita(grave = false) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();

    const notas = grave ? [523.25, 659.25] : [880, 1174.66];
    notas.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;

      const t0 = ctx.currentTime + i * 0.13;
      // Subida rápida y caída suave: suena a campana, no a bocina.
      vol.gain.setValueAtTime(0.0001, t0);
      vol.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);

      osc.connect(vol).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });
  } catch { /* si el navegador no deja, no pasa nada */ }
}

/**
 * Avisa: suena, vibra y devuelve si corresponde mostrar el cartel.
 *
 * @param {string} clave  identificador del evento, para no repetir el aviso
 *                        cuando llegan por dos vías (realtime y push)
 * @param {"mensaje"|"interno"|"pedido"} tipo
 * @returns {boolean} false si es un duplicado y hay que ignorarlo
 */
export function avisar(clave, tipo = "mensaje") {
  const ahora = Date.now();

  // Limpieza de lo viejo, para que el Map no crezca para siempre.
  for (const [k, t] of recientes) if (ahora - t > 60000) recientes.delete(k);

  // Ventana corta: dentro del APK el mismo mensaje llega dos veces (por
  // Supabase en vivo y por la push), y con dos avisos seguidos molesta.
  // Pasados unos segundos, un mensaje nuevo del mismo cliente sí vuelve a sonar.
  if (clave && ahora - (recientes.get(clave) || 0) < 6000) return false;
  if (clave) recientes.set(clave, ahora);

  if (!sonidoActivado()) return true;

  campanita(tipo === "pedido");
  try { navigator.vibrate?.(tipo === "pedido" ? [90, 60, 90] : 120); } catch { /* sin vibrador */ }
  return true;
}

/** Para el botón "probar sonido" de Ajustes. */
export function probarSonido() {
  campanita(false);
  try { navigator.vibrate?.(120); } catch { /* sin vibrador */ }
}
