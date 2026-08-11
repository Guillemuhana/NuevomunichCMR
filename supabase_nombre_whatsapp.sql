-- ─────────────────────────────────────────────────────────────
-- Nombre real del cliente en los chats
--
-- Problema: los chats mostraban "Nuevo Cliente" en vez del nombre
-- que el cliente tiene puesto en su WhatsApp. El bot de n8n mandaba
-- ese texto como placeholder cuando la IA no había preguntado el
-- nombre, y como ingest_mensaje nunca pisa un nombre ya guardado,
-- el placeholder quedaba para siempre.
--
-- Ya se corrigió el workflow de n8n para que mande el nombre del
-- perfil de WhatsApp (contacts[0].profile.name). Falta:
--   1) que la base trate "Nuevo Cliente" como "sin nombre"
--   2) limpiar los contactos que ya quedaron con el placeholder
-- ─────────────────────────────────────────────────────────────

-- 1) Limpiar los contactos existentes con el placeholder.
--    Quedan en NULL: el CRM muestra el teléfono, y en cuanto el
--    cliente escriba de nuevo se completa con su nombre de WhatsApp.
update contactos
   set nombre = null
 where lower(trim(nombre)) in ('nuevo cliente', 'cliente directo', 'cliente');

-- 2) ingest_mensaje (5 parámetros — la que usa hoy n8n)
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
    set nombre = coalesce(excluded.nombre, contactos.nombre)
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

-- 3) ingest_mensaje (8 parámetros — versión con media)
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
    set nombre = coalesce(excluded.nombre, contactos.nombre)
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
