// ============================================================
// Notificaciones push nativas (solo dentro del APK Android)
// ------------------------------------------------------------
// Este módulo NO hace absolutamente nada en el navegador ni en
// el iPhone (PWA): todo está detrás de `esNativo()`. La web sigue
// funcionando exactamente igual que antes.
// ============================================================
import { supabase, getIdentidadInterna, getRol, VENDEDORES_INFO } from "./lib";

export function esNativo() {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
}

// Alias de vendedor tal como se guarda en contactos.vendedor ("Boris", "Cristian"…)
function getVendedorAlias(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  const v = VENDEDORES_INFO.find((v) => v.emailPrefix === prefix);
  if (v) return v.alias || v.nombre;
  return prefix.replace(/^\w/, (m) => m.toUpperCase());
}

let tokenActual = null;
let registrando = false;      // evita registrar dos veces en paralelo
let usuarioRegistrado = null; // id del usuario al que está asociado el token

// Guarda el token de este celular contra el usuario logueado.
async function guardarToken(token, session) {
  if (!token || !session?.user) return;
  tokenActual = token;
  usuarioRegistrado = session.user.id;
  const email = session.user.email;
  const { error } = await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: session.user.id,
      user_email: email,
      user_key: getIdentidadInterna(email).key,
      rol: getRol(email),
      vendedor_alias: getVendedorAlias(email),
      platform: window.Capacitor?.getPlatform?.() || "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) console.warn("[push] no se pudo guardar el token:", error.message);
}

// Al tocar la notificación, abrir la pantalla que corresponde.
function abrirDesdeNotificacion(data) {
  if (!data) return;
  try {
    if (data.contacto_id) window.dispatchEvent(new CustomEvent("push:abrir-chat", { detail: data }));
    else if (data.vista) window.dispatchEvent(new CustomEvent("push:abrir-vista", { detail: data }));
  } catch (e) {
    console.warn("[push] no se pudo abrir la notificación:", e);
  }
}

/**
 * Inicializa las notificaciones push. Llamar una sola vez, con sesión activa.
 * En web/iPhone retorna sin hacer nada.
 */
export async function initPush(session) {
  if (!esNativo() || !session?.user) return;
  if (usuarioRegistrado === session.user.id || registrando) return;

  // Si el celular ya tiene token y cambió el usuario (otro vendedor se logueó
  // en el mismo teléfono), basta con reasignar el token al nuevo usuario.
  if (tokenActual) {
    await guardarToken(tokenActual, session);
    return;
  }

  registrando = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permiso = await PushNotifications.checkPermissions();
  if (permiso.receive === "prompt" || permiso.receive === "prompt-with-rationale") {
    permiso = await PushNotifications.requestPermissions();
  }
  if (permiso.receive !== "granted") {
    console.warn("[push] el usuario no dio permiso de notificaciones");
    registrando = false;
    return;
  }

  // Canal de notificaciones (Android 8+). Sin esto las push no suenan.
  await PushNotifications.createChannel({
    id: "munich_crm",
    name: "CRM Nuevo Munich",
    description: "Mensajes de clientes, mensajes internos y pedidos",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: "#A81F1F",
  }).catch(() => {});

  PushNotifications.addListener("registration", (t) => guardarToken(t.value, session));
  PushNotifications.addListener("registrationError", (e) =>
    console.warn("[push] error registrando:", JSON.stringify(e))
  );
  PushNotifications.addListener("pushNotificationActionPerformed", (accion) =>
    abrirDesdeNotificacion(accion?.notification?.data)
  );

  await PushNotifications.register();
  await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
  registrando = false;
}

/** Borra el token de este celular al cerrar sesión (para que no siga recibiendo). */
export async function limpiarPush() {
  if (!esNativo() || !tokenActual) return;
  await supabase.from("push_tokens").delete().eq("token", tokenActual);
  usuarioRegistrado = null;
}

/**
 * Ajustes nativos de la cáscara Android: botón "atrás" y barra de estado.
 * También es un no-op en web.
 */
export async function initNativo() {
  if (!esNativo()) return;

  const [{ App }, { StatusBar, Style }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
  ]);

  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#A81F1F" }).catch(() => {});

  // Botón atrás de Android: volver en el historial; si no hay, mandar la app
  // a segundo plano en vez de cerrarla (como WhatsApp).
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else App.minimizeApp();
  });
}
