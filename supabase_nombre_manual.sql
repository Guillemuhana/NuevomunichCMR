-- ─────────────────────────────────────────────────────────────
-- El nombre guardado a mano manda sobre el de WhatsApp
--
-- Problema: al guardar los datos del cliente desde el CRM (nombre,
-- empresa, email, dirección), el nombre se perdía en cuanto el cliente
-- volvía a escribir: ingest_mensaje pisaba `contactos.nombre` con el
-- nombre del perfil de WhatsApp (`coalesce(excluded.nombre, ...)`).
--
-- Solución: invertir la precedencia. El nombre del perfil de WhatsApp
-- solo se usa para completar contactos que todavía no tienen nombre
-- (null o vacío); si alguien ya lo cargó a mano, queda registrado.
--
-- Ejecutar este archivo en el SQL Editor de Supabase. Reemplaza las dos
-- versiones de ingest_mensaje de supabase_nombre_whatsapp.sql.
-- ─────────────────────────────────────────────────────────────

-- 1) ingest_mensaje (5 parámetros — la que usa hoy n8n)
create or replace function ingest_mensaje(
  p_telefono text, p_nombre text, p_contenido text,
  p_direccion text, p_origen text
) returns void as $$
declare
  v_id uuid; v_last_out timestamptz; v_created timestamptz := now();
  v_nombre text := nullif(trim(coalesce(p_nombre,'')),'');
begin
  -- Los placeholders del bot no son nombres reales
  if lower(coalesce(v_nombre,'')) in ('nuevo cliente','cliente directo','cliente') then
    v_nombre := null;
  end if;

  insert into contactos (telefono, nombre)
  values (p_telefono, v_nombre)
  on conflict (telefono) do update
    -- El nombre cargado en el CRM gana; el de WhatsApp solo rellena vacíos
    set nombre = coalesce(nullif(trim(contactos.nombre), ''), excluded.nombre)
  returning id into v_id;

  if v_id is null then
    select id into v_id from contactos where telefono = p_telefono;
  end if;

  if p_direccion = 'in' then
    select created_at into v_last_out from mensajes
      where contacto_id = v_id and direccion = 'out'
      order by created_at desc limit 1;
    if v_last_out is not null and v_last_out > now() - interval '15 seconds' then
      v_created := least(now(), v_last_out - interval '1 second');
    end if;
  end if;

  insert into mensajes (contacto_id, direccion, origen, contenido, created_at)
  values (v_id, p_direccion, p_origen, p_contenido, v_created);
end;
$$ language plpgsql security definer;

-- 2) ingest_mensaje (8 parámetros — versión con media)
create or replace function ingest_mensaje(
  p_telefono text, p_nombre text, p_contenido text,
  p_direccion text, p_origen text,
  p_media_url text, p_media_tipo text, p_media_nombre text
) returns void as $$
declare
  v_id uuid; v_last_out timestamptz; v_created timestamptz := now();
  v_nombre text := nullif(trim(coalesce(p_nombre,'')),'');
begin
  if lower(coalesce(v_nombre,'')) in ('nuevo cliente','cliente directo','cliente') then
    v_nombre := null;
  end if;

  insert into contactos (telefono, nombre)
  values (p_telefono, v_nombre)
  on conflict (telefono) do update
    set nombre = coalesce(nullif(trim(contactos.nombre), ''), excluded.nombre)
  returning id into v_id;

  if v_id is null then
    select id into v_id from contactos where telefono = p_telefono;
  end if;

  if p_direccion = 'in' then
    select created_at into v_last_out from mensajes
      where contacto_id = v_id and direccion = 'out'
      order by created_at desc limit 1;
    if v_last_out is not null and v_last_out > now() - interval '15 seconds' then
      v_created := least(now(), v_last_out - interval '1 second');
    end if;
  end if;

  insert into mensajes (contacto_id, direccion, origen, contenido, media_url, media_tipo, media_nombre, created_at)
  values (v_id, p_direccion, p_origen, p_contenido,
          nullif(p_media_url,''), nullif(p_media_tipo,''), nullif(p_media_nombre,''), v_created);
end;
$$ language plpgsql security definer;

-- 3) Normalizar nombres vacíos ya guardados, para que WhatsApp los complete
update contactos set nombre = null where trim(coalesce(nombre,'')) = '';
