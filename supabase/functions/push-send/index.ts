// ============================================================
// Edge Function: push-send
// ------------------------------------------------------------
// Recibe un evento del CRM (mensaje de WhatsApp, mensaje interno,
// pedido nuevo), busca a qué celulares hay que avisarle y manda la
// notificación por Firebase Cloud Messaging (FCM HTTP v1).
//
// Secrets necesarios (Dashboard > Edge Functions > Secrets):
//   FCM_SERVICE_ACCOUNT  -> JSON completo de la cuenta de servicio de Firebase
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen inyectados)
// ============================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

type Payload = {
  tipo: "whatsapp" | "interno" | "pedido" | string;
  titulo: string;
  cuerpo: string;
  vendedor?: string | null;   // alias del vendedor dueño del contacto
  user_key?: string | null;   // destinatario puntual (mensajería interna)
  roles?: string[] | null;    // roles a notificar
  data?: Record<string, string>;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------- Autenticación contra Google (OAuth2 con cuenta de servicio) ----------
let cacheToken: { valor: string; expira: number } | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const limpio = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(limpio);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: { client_email: string; private_key: string }) {
  const ahora = Math.floor(Date.now() / 1000);
  if (cacheToken && cacheToken.expira > ahora + 60) return cacheToken.valor;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  }));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${b64url(firma)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth Google falló: ${await res.text()}`);
  const json = await res.json();
  cacheToken = { valor: json.access_token, expira: ahora + (json.expires_in ?? 3600) };
  return cacheToken.valor;
}

// ---------- A quién le mandamos ----------
async function destinatarios(p: Payload): Promise<string[]> {
  const tokens = new Set<string>();
  const agregar = (filas: { token: string }[] | null) =>
    (filas ?? []).forEach((f) => tokens.add(f.token));

  if (p.tipo === "interno" && p.user_key) {
    const { data } = await supabase.from("push_tokens").select("token").eq("user_key", p.user_key);
    agregar(data);
    return [...tokens];
  }

  if (p.tipo === "whatsapp") {
    // El vendedor dueño del contacto…
    if (p.vendedor) {
      const { data } = await supabase.from("push_tokens").select("token").eq("vendedor_alias", p.vendedor);
      agregar(data);
    }
    // …más Cristian y administración, que ven todos los chats.
    const { data: admins } = await supabase
      .from("push_tokens").select("token").in("rol", ["admin", "administracion"]);
    agregar(admins);
    return [...tokens];
  }

  const roles = p.roles?.length ? p.roles : ["admin", "administracion"];
  const { data } = await supabase.from("push_tokens").select("token").in("rol", roles);
  agregar(data);
  return [...tokens];
}

// ---------- Envío ----------
async function enviar(
  projectId: string,
  accessToken: string,
  token: string,
  p: Payload,
): Promise<{ token: string; ok: boolean; borrar: boolean }> {
  const data: Record<string, string> = { ...(p.data ?? {}), tipo: String(p.tipo) };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: p.titulo, body: p.cuerpo },
          data,
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "munich_crm",
              icon: "ic_stat_munich",
              color: "#A81F1F",
              default_sound: true,
              // Agrupa las notificaciones por conversación/tipo
              tag: p.data?.contacto_id ?? p.data?.de_key ?? String(p.tipo),
            },
          },
        },
      }),
    },
  );

  if (res.ok) return { token, ok: true, borrar: false };

  const texto = await res.text();
  // 404 UNREGISTERED / 400 INVALID_ARGUMENT => el token ya no sirve
  const borrar = res.status === 404 ||
    texto.includes("UNREGISTERED") ||
    texto.includes("INVALID_ARGUMENT");
  console.warn(`FCM ${res.status} para ${token.slice(0, 12)}…: ${texto}`);
  return { token, ok: false, borrar };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const p = (await req.json()) as Payload;
    if (!p?.titulo) return new Response(JSON.stringify({ error: "falta titulo" }), { status: 400 });

    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) throw new Error("Falta el secret FCM_SERVICE_ACCOUNT");
    const sa = JSON.parse(saRaw);

    const tokens = await destinatarios(p);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, motivo: "sin destinatarios" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(sa);
    const resultados = await Promise.all(
      tokens.map((t) => enviar(sa.project_id, accessToken, t, p)),
    );

    // Limpieza de tokens muertos (celulares que desinstalaron la app)
    const muertos = resultados.filter((r) => r.borrar).map((r) => r.token);
    if (muertos.length) await supabase.from("push_tokens").delete().in("token", muertos);

    return new Response(
      JSON.stringify({
        enviados: resultados.filter((r) => r.ok).length,
        fallidos: resultados.filter((r) => !r.ok).length,
        limpiados: muertos.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("push-send:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
