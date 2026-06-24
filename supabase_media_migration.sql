-- ============================================================
-- MIGRACIÓN: soporte de medios (imágenes, videos, audios, documentos)
-- en los mensajes del chat. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 1) Columnas de medios en la tabla mensajes
alter table mensajes add column if not exists media_url    text;
alter table mensajes add column if not exists media_tipo   text;   -- image | video | audio | document
alter table mensajes add column if not exists media_nombre text;

-- 1b) Columnas para responder/citar un mensaje (estilo WhatsApp)
alter table mensajes add column if not exists cita_texto text;
alter table mensajes add column if not exists cita_autor text;

-- 2) Bucket público de Storage para los archivos del chat
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = true;

-- 3) Políticas de Storage para el bucket chat-media
--    Lectura pública (para que getPublicUrl funcione) y subida/borrado
--    para usuarios autenticados (los agentes del CRM).
drop policy if exists "chat_media_read"   on storage.objects;
drop policy if exists "chat_media_insert" on storage.objects;
drop policy if exists "chat_media_delete" on storage.objects;

create policy "chat_media_read"
  on storage.objects for select
  using ( bucket_id = 'chat-media' );

create policy "chat_media_insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'chat-media' );

create policy "chat_media_delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'chat-media' );

-- 4) Versión ampliada de ingest_mensaje para que n8n/el bot puedan
--    guardar el medio (URL + tipo + nombre) al recibir/enviar imágenes.
--    Es una sobrecarga nueva: la versión vieja (5 parámetros) sigue funcionando.
create or replace function ingest_mensaje(
  p_telefono text, p_nombre text, p_contenido text,
  p_direccion text, p_origen text,
  p_media_url text, p_media_tipo text, p_media_nombre text
) returns void as $$
declare v_id uuid;
begin
  insert into contactos (telefono, nombre)
  values (p_telefono, nullif(p_nombre,''))
  on conflict (telefono) do update
    set nombre = coalesce(nullif(excluded.nombre,''), contactos.nombre)
  returning id into v_id;

  if v_id is null then
    select id into v_id from contactos where telefono = p_telefono;
  end if;

  insert into mensajes (contacto_id, direccion, origen, contenido, media_url, media_tipo, media_nombre)
  values (v_id, p_direccion, p_origen, p_contenido,
          nullif(p_media_url,''), nullif(p_media_tipo,''), nullif(p_media_nombre,''));
end;
$$ language plpgsql security definer;
