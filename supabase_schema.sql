-- ============================================================
-- CRM Nuevo Munich — Schema Supabase (v2: + reportes, seguimiento, alertas, seguridad)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- TABLAS ----------

create table if not exists contactos (
  id            uuid primary key default gen_random_uuid(),
  telefono      text unique not null,
  nombre        text,
  vendedor      text,                            -- Boris, Cristian, Luis, Marcelino, Pablo, Sandra
  estado        text not null default 'nuevo',   -- nuevo | en_conversacion | pedido | cerrado | perdido
  bot_activo    boolean not null default true,   -- TOGGLE: false = el bot deja de responder
  ultimo_msg    text,
  no_leidos     int not null default 0,
  -- Datos adicionales del contacto
  email         text,
  empresa       text,
  direccion     text,
  foto_url      text,                            -- URL de foto de perfil (opcional)
  -- Seguimiento al cliente
  seguimiento_at timestamptz,                     -- próximo recordatorio de contacto
  nota_seguimiento text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  ultimo_in_at  timestamptz,                      -- último mensaje entrante (para alertas)
  ultimo_out_at timestamptz                       -- última respuesta (para tiempos)
);

-- ============================================================
-- MIGRACIÓN v3: nuevos campos para instalaciones existentes
-- Ejecutar solo si ya tenías la tabla creada anteriormente.
-- ============================================================
alter table contactos add column if not exists email    text;
alter table contactos add column if not exists empresa  text;
alter table contactos add column if not exists direccion text;
alter table contactos add column if not exists foto_url text;

create table if not exists mensajes (
  id            uuid primary key default gen_random_uuid(),
  contacto_id   uuid not null references contactos(id) on delete cascade,
  direccion     text not null,                   -- 'in' | 'out'
  origen        text not null default 'bot',     -- bot | agente | cliente
  agente        text,
  contenido     text,
  wa_message_id text,
  created_at    timestamptz not null default now()
);

create table if not exists pedidos (
  id            uuid primary key default gen_random_uuid(),
  contacto_id   uuid references contactos(id) on delete set null,
  vendedor      text,
  detalle       text,
  total         numeric default 0,               -- monto (activable cuando se defina)
  estado        text not null default 'pendiente', -- pendiente | confirmado | entregado | cancelado
  created_at    timestamptz not null default now()
);

-- ---------- ÍNDICES ----------
create index if not exists idx_mensajes_contacto on mensajes (contacto_id, created_at);
create index if not exists idx_mensajes_fecha    on mensajes (created_at);
create index if not exists idx_contactos_updated on contactos (updated_at desc);
create index if not exists idx_contactos_creado  on contactos (created_at);
create index if not exists idx_pedidos_fecha     on pedidos (created_at);

-- ---------- TRIGGER: actualizar contacto al entrar/salir un mensaje ----------
create or replace function fn_touch_contacto()
returns trigger as $$
begin
  update contactos
     set ultimo_msg = left(coalesce(new.contenido, '[media]'), 120),
         updated_at = now(),
         no_leidos  = case when new.direccion = 'in' then no_leidos + 1 else no_leidos end,
         ultimo_in_at  = case when new.direccion = 'in'  then now() else ultimo_in_at end,
         ultimo_out_at = case when new.direccion = 'out' then now() else ultimo_out_at end
   where id = new.contacto_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_contacto on mensajes;
create trigger trg_touch_contacto
  after insert on mensajes
  for each row execute function fn_touch_contacto();

-- ---------- FUNCIÓN: ingest desde n8n (upsert contacto + insert mensaje) ----------
create or replace function ingest_mensaje(
  p_telefono text, p_nombre text, p_contenido text,
  p_direccion text, p_origen text
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

  insert into mensajes (contacto_id, direccion, origen, contenido)
  values (v_id, p_direccion, p_origen, p_contenido);
end;
$$ language plpgsql security definer;

-- ---------- VISTA: métricas diarias agregadas (para reportes rápidos) ----------
create or replace view v_metricas_dia as
select
  date_trunc('day', created_at)::date as dia,
  count(*) filter (where direccion='in')  as msgs_in,
  count(*) filter (where direccion='out') as msgs_out,
  count(*) filter (where origen='bot')    as msgs_bot,
  count(*) filter (where origen='agente') as msgs_agente
from mensajes
group by 1
order by 1;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table mensajes;
alter publication supabase_realtime add table contactos;
alter publication supabase_realtime add table pedidos;

-- ============================================================
-- SEGURIDAD — RLS (Row Level Security)
-- Solo usuarios autenticados (los 3 del equipo) acceden.
-- El service_role (n8n) bypasea RLS automáticamente.
-- ============================================================
alter table contactos enable row level security;
alter table mensajes  enable row level security;
alter table pedidos   enable row level security;

drop policy if exists "auth_full_contactos" on contactos;
drop policy if exists "auth_full_mensajes"  on mensajes;
drop policy if exists "auth_full_pedidos"   on pedidos;

create policy "auth_full_contactos" on contactos
  for all to authenticated using (true) with check (true);
create policy "auth_full_mensajes" on mensajes
  for all to authenticated using (true) with check (true);
create policy "auth_full_pedidos" on pedidos
  for all to authenticated using (true) with check (true);

-- Nota: los usuarios anónimos (sin login) NO tienen ninguna política => acceso denegado.
-- Esto garantiza que nadie sin sesión válida pueda leer datos de clientes.

-- ============================================================
-- USUARIOS (crear en Authentication > Users > Add user):
--   boris@nuevomunich.com.ar
--   cristian@nuevomunich.com.ar
--   sandra@nuevomunich.com.ar
--   admin@nuevomunich.com.ar
-- ============================================================
