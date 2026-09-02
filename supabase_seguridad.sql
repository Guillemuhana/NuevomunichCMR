-- ============================================================
-- SEGURIDAD — lo que ya se aplicó y lo que queda pendiente
-- ------------------------------------------------------------
-- Este archivo no hay que "correrlo entero": la primera parte YA
-- está aplicada en la base (2/9/2026). Queda acá para saber qué se
-- tocó y por qué, y para poder repetirlo si alguna vez hay que
-- levantar el proyecto de cero.
--
-- Estado del proyecto al momento de la revisión:
--   · RLS prendido en las 18 tablas de `public`.
--   · Ninguna clave en el repo: .env está ignorado desde siempre,
--     la service_role vive sólo en n8n y el google-services.json
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
-- PENDIENTE — no lo corras sin leer el comentario de arriba de cada
-- bloque: alguno puede romper la entrada de mensajes de WhatsApp.
-- ============================================================

-- ---------- 1) Las funciones de ingreso abiertas a `anon` ----------
-- ingest_mensaje, ingest_email y fn_push_enviar son SECURITY DEFINER
-- y hoy las puede llamar cualquiera con la clave pública: se pueden
-- inventar mensajes y contactos, o dispararles una notificación push
-- a los teléfonos de los vendedores.
--
-- El README dice que n8n entra con la service_role key, que ignora
-- estos permisos — si es así, este revoke no rompe nada. ANTES de
-- correrlo hay que confirmarlo en n8n (credencial del nodo Supabase),
-- porque si algún workflow quedó con la clave anon se corta la
-- entrada de mensajes de WhatsApp.
--
-- revoke execute on function public.ingest_mensaje(text,text,text,text,text,text,text,text) from public, anon;
-- revoke execute on function public.ingest_email(text,text,text,text,text,text) from public, anon;
-- revoke execute on function public.ingest_email(text,text,text,text,text,text,text,text,text) from public, anon;
-- revoke execute on function public.fn_push_enviar(jsonb) from public, anon, authenticated;

-- ---------- 2) Un contacto expuesto sin login ----------
-- La política `anon_select_messenger_contactos` deja leer sin sesión
-- cualquier contacto que tenga messenger_id. Hoy es 1 solo contacto
-- de 323, pero es una fila de datos personales al aire. Si la
-- integración con Messenger no la usa, se borra:
--
-- drop policy if exists anon_select_messenger_contactos on public.contactos;

-- ---------- 3) Lo grande: los permisos por rol viven en la pantalla ----------
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


-- ============================================================
-- Y esto no es SQL: hay que tildarlo en el panel de Supabase
-- ------------------------------------------------------------
-- Authentication → Providers → Email:
--   · "Prevent use of leaked passwords" (lo compara contra
--     HaveIBeenPwned) — hoy está apagado.
--   · Mínimo de largo de contraseña y caracteres requeridos.
-- ============================================================
