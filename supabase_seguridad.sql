-- ============================================================
-- SEGURIDAD — lo que ya se aplicó y lo que queda pendiente
-- ------------------------------------------------------------
-- Este archivo no hay que "correrlo entero": la parte de APLICADO
-- ya está en la base. Queda acá para saber qué se tocó y por qué,
-- y para poder repetirlo si alguna vez hay que levantar el
-- proyecto de cero.
--
-- Estado del proyecto al momento de la revisión (2/9/2026):
--   · RLS prendido en las 18 tablas de `public`.
--   · Ninguna clave en el repo: .env está ignorado desde siempre,
--     la clave secreta vive sólo en n8n y el google-services.json
--     de Firebase está fuera del control de versiones.
--   · Sin `dangerouslySetInnerHTML` en el front: no hay superficie
--     de XSS por HTML inyectado.
-- ============================================================


-- ============================================================
-- APLICADO — 2/9/2026
-- ============================================================

-- ---------- notas_marcar_vistas estaba abierta a `anon` ----------
-- Es SECURITY DEFINER y recibe el email por parámetro, así que
-- cualquiera con la clave pública (que viaja en el bundle, como en
-- toda app de Supabase) podía marcar notas como leídas en nombre de
-- otro y apagarle el aviso del pizarrón. La llama únicamente el CRM
-- y siempre con sesión iniciada, así que `anon` no la necesita.
revoke execute on function public.notas_marcar_vistas(text, uuid[]) from public;
revoke execute on function public.notas_marcar_vistas(text, uuid[]) from anon;
grant  execute on function public.notas_marcar_vistas(text, uuid[]) to authenticated;

-- ---------- search_path fijo ----------
-- Sin esto, quien pueda crear objetos en otro esquema podría lograr
-- que la función resuelva `notas` a una tabla suya.
alter function public.notas_marcar_vistas(text, uuid[]) set search_path = public, pg_temp;
alter function public.notas_touch() set search_path = public, pg_temp;


-- ============================================================
-- APLICADO — 2/9/2026 · cerrar las funciones de ingreso
-- ------------------------------------------------------------
-- Corrido y verificado: las cuatro quedaron en service_role = true,
-- anon = false. n8n conserva el permiso, que era lo único que podía
-- romperse.
--
-- ingest_mensaje, ingest_email y fn_push_enviar son SECURITY DEFINER
-- y hoy las puede llamar cualquiera con la clave pública: se pueden
-- inventar mensajes y contactos, o dispararle una notificación push
-- al teléfono de los vendedores.
--
-- ¿Rompe la entrada de WhatsApp? No. Se verificó en n8n el 2/9: los
-- nodos "Guardar Msj Cliente (Siempre)" y "Guardar Resp Bot" del
-- workflow NuevoMunich-Chat mandan la clave SECRETA en el header,
-- no la anon. Y hay prueba en vivo: la versión de 5 parámetros de
-- ingest_mensaje ya tenía `anon` cerrado desde antes y el bot la
-- viene llamando sin fallar (64 veces en las últimas 24 h).
--
-- El grant a service_role va primero y a propósito: si el permiso
-- lo estuviera heredando de PUBLIC, el revoke de abajo se lo
-- llevaría puesto y ahí sí se cortaría WhatsApp.
--
-- ingest_email lo llama sólo "NINIT CRM - Gmail Sync", que está
-- apagado y es de otro proyecto.

grant execute on function public.ingest_mensaje(text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.ingest_email(text,text,text,text,text,text) to service_role;
grant execute on function public.ingest_email(text,text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.fn_push_enviar(jsonb) to service_role;

revoke execute on function public.ingest_mensaje(text,text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.ingest_email(text,text,text,text,text,text) from public, anon;
revoke execute on function public.ingest_email(text,text,text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.fn_push_enviar(jsonb) from public, anon;

-- Verificación: las cuatro tienen que quedar en service_role = true,
-- anon = false.
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_puede,
       has_function_privilege('anon', p.oid, 'execute')         as anon_puede
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('ingest_mensaje','ingest_email','fn_push_enviar')
 order by p.proname;

-- Si algo se rompiera, esto lo deja como estaba:
--   grant execute on function public.ingest_mensaje(text,text,text,text,text,text,text,text) to anon;


-- ============================================================
-- PENDIENTE
-- ============================================================

-- ---------- 1) Un contacto expuesto sin login ----------
-- La política `anon_select_messenger_contactos` deja leer sin sesión
-- cualquier contacto que tenga messenger_id. Hoy es 1 solo contacto
-- de 323, pero es una fila de datos personales al aire. Si la
-- integración con Messenger no la usa, se borra:
--
-- drop policy if exists anon_select_messenger_contactos on public.contactos;

-- ---------- 2) Lo grande: los permisos por rol viven en la pantalla ----------
-- Hoy toda persona logueada puede hacer todo sobre todas las tablas
-- (`usando = true` en cada política). Que un vendedor no vea los
-- pedidos de otro es una decisión del front, no de la base: con la
-- clave pública y un token válido, cualquiera del equipo puede leer
-- la base entera desde la consola del navegador.
--
-- Cerrarlo de verdad es escribir políticas por rol, y es un trabajo
-- aparte que hay que hacer tabla por tabla y probando, porque mal
-- hecho deja gente sin ver lo suyo. El esqueleto sería:
--
-- create or replace function public.es_admin() returns boolean
--   language sql stable as $$
--     select coalesce(split_part(auth.jwt() ->> 'email', '@', 1), '') in ('cristian')
--         or split_part(auth.jwt() ->> 'email', '@', 1) like 'admin%'
--   $$;
--
-- drop policy auth_full_pedidos on public.pedidos;
-- create policy pedidos_lectura on public.pedidos for select to authenticated
--   using (public.es_admin() or vendedor = split_part(auth.jwt() ->> 'email', '@', 1));

-- ---------- 3) La clave secreta, escrita a mano en n8n ----------
-- En el workflow NuevoMunich-Chat la clave secreta de Supabase está
-- puesta como texto plano en los headers de los nodos HTTP, en vez
-- de ir en una credencial de n8n. Esa clave abre la base entera y
-- se saltea RLS: viaja en cualquier export del workflow y la ve
-- cualquiera que entre a n8n. Conviene moverla a una credencial
-- (Header Auth) y, si el JSON del workflow alguna vez se compartió,
-- rotarla desde Settings → API del panel de Supabase.


-- ============================================================
-- DESCARTADO POR AHORA
-- ------------------------------------------------------------
-- "Prevent use of leaked passwords" en Authentication → Providers.
-- Decisión de Cristian (2/9): las cuentas del equipo usan mails que
-- no son reales, así que se deja para más adelante. Aclaración por
-- si se retoma: la opción no mira el mail, compara la CONTRASEÑA
-- contra la lista de HaveIBeenPwned; funciona igual con mails
-- inventados.
-- ============================================================
