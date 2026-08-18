-- ============================================================
-- NOTIFICACIONES PUSH (app Android)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ------------------------------------------------------------
-- Crea la tabla de tokens de cada celular y los disparadores que
-- llaman a la Edge Function `push-send` cuando pasa algo que hay
-- que avisar (mensaje de WhatsApp, mensaje interno, pedido nuevo).
-- ============================================================

-- ---------- 1. TABLA DE TOKENS ----------
create table if not exists push_tokens (
  token          text primary key,          -- token FCM de ese celular
  user_id        uuid references auth.users(id) on delete cascade,
  user_email     text,
  user_key       text,                      -- 'cristian' | 'administracion' | 'boris' | ...
  rol            text,                      -- admin | administracion | vendedor_panel | vendedor
  vendedor_alias text,                      -- 'Boris', 'Cristian'... (coincide con contactos.vendedor)
  platform       text default 'android',
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists idx_push_user_key  on push_tokens (user_key);
create index if not exists idx_push_vendedor  on push_tokens (vendedor_alias);
create index if not exists idx_push_rol       on push_tokens (rol);

-- RLS: cada usuario administra únicamente sus propios tokens.
alter table push_tokens enable row level security;

drop policy if exists "push_tokens_propios" on push_tokens;
drop policy if exists "push_tokens_select" on push_tokens;
drop policy if exists "push_tokens_insert" on push_tokens;
drop policy if exists "push_tokens_update" on push_tokens;
drop policy if exists "push_tokens_delete" on push_tokens;

create policy "push_tokens_select" on push_tokens
  for select to authenticated using (auth.uid() = user_id);

create policy "push_tokens_insert" on push_tokens
  for insert to authenticated with check (auth.uid() = user_id);

-- UPDATE con using(true): si otro vendedor inicia sesión en el mismo celular,
-- el token ya existe a nombre del anterior y hay que poder reasignarlo. El
-- with check garantiza que solo puede quedar a nombre de uno mismo.
create policy "push_tokens_update" on push_tokens
  for update to authenticated using (true) with check (auth.uid() = user_id);

create policy "push_tokens_delete" on push_tokens
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- 2. CONFIGURACIÓN DEL DISPARADOR ----------
-- pg_net permite que Postgres haga llamadas HTTP a la Edge Function.
create extension if not exists pg_net with schema extensions;

-- Guardamos la URL y la service_role key en una tabla de config privada
-- (no accesible desde el frontend) en vez de hardcodearlas en cada trigger.
create table if not exists push_config (
  id         int primary key default 1,
  func_url   text not null,
  service_key text not null,
  constraint push_config_una_fila check (id = 1)
);
alter table push_config enable row level security;  -- sin políticas => nadie desde el cliente

-- >>> EDITAR ESTA LÍNEA: pegá tu SERVICE ROLE KEY de Supabase
--     (Dashboard > Project Settings > API > service_role, la clave secreta)
insert into push_config (id, func_url, service_key)
values (
  1,
  'https://sxfnqucwcteiligdtehq.supabase.co/functions/v1/push-send',
  'PEGAR_AQUI_TU_SERVICE_ROLE_KEY'
)
on conflict (id) do update
  set func_url = excluded.func_url,
      service_key = excluded.service_key;

-- Helper: dispara la Edge Function de forma asíncrona (no frena el insert).
create or replace function fn_push_enviar(p_payload jsonb)
returns void as $$
declare cfg push_config%rowtype;
begin
  select * into cfg from push_config where id = 1;
  if cfg.func_url is null then return; end if;

  perform net.http_post(
    url     := cfg.func_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || cfg.service_key
               ),
    body    := p_payload,
    timeout_milliseconds := 5000
  );
exception when others then
  -- Nunca romper la operación original por un fallo de notificación.
  raise warning 'push: %', sqlerrm;
end;
$$ language plpgsql security definer;

-- ---------- 3. WHATSAPP: mensaje entrante de un cliente ----------
create or replace function fn_push_mensaje_wa()
returns trigger as $$
declare c contactos%rowtype;
begin
  if new.direccion <> 'in' then return new; end if;

  select * into c from contactos where id = new.contacto_id;
  if c.id is null then return new; end if;

  perform fn_push_enviar(jsonb_build_object(
    'tipo',    'whatsapp',
    'titulo',  coalesce(nullif(trim(c.nombre), ''), c.telefono),
    'cuerpo',  left(coalesce(new.contenido, 'Envió un archivo'), 140),
    'vendedor', c.vendedor,
    'data',    jsonb_build_object(
                 'contacto_id', c.id::text,
                 'telefono',    c.telefono,
                 'vista',       'chat'
               )
  ));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_push_mensaje_wa on mensajes;
create trigger trg_push_mensaje_wa
  after insert on mensajes
  for each row execute function fn_push_mensaje_wa();

-- ---------- 4. MENSAJERÍA INTERNA ----------
create or replace function fn_push_mensaje_interno()
returns trigger as $$
begin
  perform fn_push_enviar(jsonb_build_object(
    'tipo',     'interno',
    'titulo',   coalesce(nullif(trim(new.de_nombre), ''), new.de_key),
    'cuerpo',   left(new.texto, 140),
    'user_key', new.para_key,
    'data',     jsonb_build_object('vista', 'mensajes', 'de_key', new.de_key)
  ));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_push_mensaje_interno on mensajes_internos;
create trigger trg_push_mensaje_interno
  after insert on mensajes_internos
  for each row execute function fn_push_mensaje_interno();

-- ---------- 5. PEDIDO NUEVO (avisa a administración y a Cristian) ----------
create or replace function fn_push_pedido()
returns trigger as $$
declare nombre text;
begin
  select coalesce(nullif(trim(c.nombre), ''), c.telefono) into nombre
    from contactos c where c.id = new.contacto_id;

  perform fn_push_enviar(jsonb_build_object(
    'tipo',   'pedido',
    'titulo', 'Nuevo pedido' || case when new.vendedor is not null
                                     then ' de ' || new.vendedor else '' end,
    'cuerpo', coalesce(nombre, 'Cliente') || ' — pedido cargado',
    'roles',  jsonb_build_array('administracion', 'admin'),
    'data',   jsonb_build_object('vista', 'pedidos', 'pedido_id', new.id::text)
  ));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_push_pedido on pedidos;
create trigger trg_push_pedido
  after insert on pedidos
  for each row execute function fn_push_pedido();
