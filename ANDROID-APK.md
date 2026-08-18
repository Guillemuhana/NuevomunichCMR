# App Android (APK) — Nuevo Munich CRM

## Qué se hizo

La app Android **no es una app aparte**: es la misma web que ya usás, metida
dentro de una cáscara nativa (Capacitor). Carga directamente
`https://munich-crm.vercel.app`.

Eso significa:

- **Cristian en la web:** todo igual, no cambia nada.
- **iPhone:** todo igual, se sigue agregando a la pantalla de inicio como PWA.
- **Android:** los vendedores instalan un APK y tienen ícono propio, pantalla
  completa sin barra del navegador y **notificaciones push reales** (les llega
  el aviso aunque tengan la app cerrada y el celu guardado).
- **Actualizaciones:** cuando desplegás a Vercel, el APK se actualiza solo.
  Solo hay que volver a generar el APK si cambia algo nativo (ícono, permisos,
  plugins).

---

## Puesta en marcha (una sola vez)

### Paso 1 — Firebase (para las notificaciones)

1. Entrá a https://console.firebase.google.com → **Agregar proyecto** →
   nombre `Nuevo Munich CRM`. Podés desactivar Google Analytics.
2. Dentro del proyecto, tocá el ícono de **Android** para agregar una app.
   - **Nombre del paquete:** `ar.com.nuevomunich.crm` ← exactamente así.
   - Apodo: `CRM Android`. SHA-1 no hace falta.
3. Descargá el archivo **`google-services.json`**.
4. Andá a ⚙️ **Configuración del proyecto → Cuentas de servicio →
   Generar nueva clave privada**. Se descarga otro JSON (este es la
   **cuenta de servicio**, sirve para *enviar* las notificaciones).

Quedan dos archivos JSON distintos. No los mezcles.

### Paso 2 — Secrets en GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Valor |
|---|---|
| `GOOGLE_SERVICES_JSON` | Todo el contenido del `google-services.json` (abrilo con el Bloc de notas y copiá todo) |
| `VITE_SUPABASE_URL` | Lo mismo que tenés en tu `.env` |
| `VITE_SUPABASE_ANON_KEY` | Lo mismo que tenés en tu `.env` |
| `VITE_N8N_SEND_WEBHOOK` | Lo mismo que tenés en tu `.env` |
| `VITE_GROK_API_KEY` | Lo mismo que tenés en tu `.env` |
| `VITE_AZURE_SPEECH_KEY` | Lo mismo que tenés en tu `.env` |
| `VITE_AZURE_SPEECH_REGION` | Lo mismo que tenés en tu `.env` |

### Paso 3 — Crear la llave de firma del APK

En GitHub → pestaña **Actions** → **1. Crear llave de firma (una sola vez)** →
**Run workflow**. Poné una contraseña y anotala.

Cuando termina, abrí el log del paso *"Mostrar el valor para el secret"* y
guardá estos 4 secrets nuevos:

| Secret | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | El texto largo que imprimió |
| `ANDROID_KEYSTORE_PASSWORD` | La contraseña que pusiste |
| `ANDROID_KEY_ALIAS` | `munich` |
| `ANDROID_KEY_PASSWORD` | La misma contraseña |

⚠️ **Descargá también el artifact `keystore-GUARDAR-EN-LUGAR-SEGURO`** y
guardá ese archivo `.jks` en Drive o donde no se pierda. Si lo perdés, no vas a
poder publicar actualizaciones del APK sobre las instalaciones existentes.

### Paso 4 — Supabase: tabla y disparadores ✅ YA HECHO

La tabla `push_tokens`, la config privada `push_config` y los tres disparadores
ya están aplicados en el proyecto `sxfnqucwcteiligdtehq`. El archivo
[`supabase_push_notifications.sql`](supabase_push_notifications.sql) queda como
referencia por si hay que rehacerlo desde cero.

### Paso 5 — Supabase: la función que envía

La Edge Function `push-send` **ya está desplegada y activa**. Se autentica con un
secreto compartido guardado en `push_config` (no usa la service_role key).

Falta **una sola cosa**, y sólo la podés hacer vos:

1. Supabase → **Project Settings → Edge Functions → Secrets**.
2. Creá el secret **`FCM_SERVICE_ACCOUNT`** y pegá **todo el JSON de la cuenta
   de servicio** del Paso 1.4 (el archivo `...firebase-adminsdk-....json`).

Para comprobar que quedó bien:

```
curl -X POST https://sxfnqucwcteiligdtehq.supabase.co/functions/v1/push-send   -H "Authorization: Bearer <el secreto de push_config>"   -H "Content-Type: application/json"   -d '{"tipo":"test","titulo":"t","cuerpo":"c"}'
```

Si responde `{"enviados":0,"motivo":"sin destinatarios"}` está perfecto (todavía
no hay celulares registrados). Si responde `Falta el secret FCM_SERVICE_ACCOUNT`,
el secret no quedó guardado.

### Paso 6 — Generar el APK

GitHub → **Actions** → **2. Compilar APK Android** → **Run workflow** →
poné la versión (`1.0.0`) y dale.

A los ~5 minutos el APK queda en dos lugares:
- Al pie de la ejecución, en **Artifacts**.
- En **Releases**, con un link público que le podés mandar a los vendedores
  por WhatsApp.

---

## Cómo instala un vendedor

1. Abre el link del APK que le mandaste por WhatsApp.
2. Lo descarga y lo toca.
3. Android avisa *"Por seguridad, no se permite instalar apps de esta fuente"*
   → toca **Ajustes** → activa **Permitir de esta fuente** → **Atrás** →
   **Instalar**.
4. Abre la app, inicia sesión con su mail y contraseña de siempre.
5. Le pide permiso de notificaciones → **Permitir**. Listo.

## Cómo actualizar

- **Cambios en la app (pantallas, lógica, textos):** desplegás a Vercel como
  siempre (`npx vercel --prod --yes`) y los celulares lo toman al abrir. **No
  hay que reinstalar nada.**
- **Cambios nativos (ícono, permisos, plugins):** volvés a correr el workflow
  *2. Compilar APK Android* con una versión nueva y les pasás el APK nuevo.

---

## Qué notificaciones llegan

| Cuándo | A quién |
|---|---|
| Entra un mensaje de WhatsApp de un cliente | Al vendedor dueño del contacto + Cristian + Administración |
| Llega un mensaje interno del CRM | Solo al destinatario |
| Se carga un pedido nuevo | A Administración y a Cristian |

Se cambian editando los disparadores al final de
`supabase_push_notifications.sql`.

## Si algo no anda

- **No llega ninguna notificación:** revisá que exista una fila en la tabla
  `push_tokens` para ese usuario (Supabase → Table Editor). Si no está, el
  celular no registró: que cierre sesión y vuelva a entrar aceptando el permiso.
- **Llegan a unos sí y a otros no:** el que no recibe tiene el permiso de
  notificaciones apagado en Ajustes de Android, o tiene la app en "optimización
  de batería" restringida.
- **Ver por qué falló un envío:** Supabase → Edge Functions → `push-send` → Logs.
- **La app abre en blanco:** no hay internet, o Vercel está caído. La app
  necesita conexión (igual que la web).
