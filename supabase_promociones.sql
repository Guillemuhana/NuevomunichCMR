-- ============================================================
-- PROMOCIONES — campañas de WhatsApp con plantillas de Meta
-- Pegá esto en Supabase → SQL Editor → RUN
-- ============================================================
-- Tres tablas:
--   plantillas_wa    → las plantillas que ya tenés aprobadas en Meta
--   campanias        → cada envío masivo que armás
--   campania_envios  → una fila por contacto, con cómo le fue
-- ============================================================

-- ---------- 1. PLANTILLAS ----------
-- Sólo guardamos los datos que Meta necesita para el envío. El texto
-- es una copia para ver la vista previa; el que manda es el de Meta.
create table if not exists public.plantillas_wa (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,                      -- nombre exacto en Meta (ej: promo_agosto)
  idioma       text not null default 'es_AR',      -- código de idioma de Meta
  categoria    text default 'MARKETING',
  cuerpo       text,                               -- copia del texto, con {{1}} {{2}} donde van las variables
  variables    jsonb not null default '[]'::jsonb, -- [{ "num": 1, "descripcion": "nombre del cliente" }]
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (nombre, idioma)
);

-- ---------- 2. CAMPAÑAS ----------
create table if not exists public.campanias (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  plantilla_id  uuid references public.plantillas_wa(id) on delete set null,
  plantilla     text not null,                     -- nombre de la plantilla, congelado
  idioma        text not null default 'es_AR',
  -- Cómo se completa cada variable: [{ "num":1, "tipo":"campo|fijo", "valor":"nombre" }]
  parametros    jsonb not null default '[]'::jsonb,
  filtros       jsonb not null default '{}'::jsonb, -- a quiénes se eligió
  estado        text not null default 'borrador',   -- borrador | enviando | pausada | terminada
  total         int not null default 0,
  enviados      int not null default 0,
  fallidos      int not null default 0,
  creada_por    text,
  created_at    timestamptz not null default now(),
  iniciada_at   timestamptz,
  terminada_at  timestamptz
);

-- ---------- 3. ENVÍOS ----------
-- Las filas se crean todas juntas al lanzar la campaña, en 'pendiente'.
-- Así, si se corta el envío, se puede retomar exactamente donde quedó.
create table if not exists public.campania_envios (
  id            uuid primary key default gen_random_uuid(),
  campania_id   uuid not null references public.campanias(id) on delete cascade,
  contacto_id   uuid references public.contactos(id) on delete cascade,
  telefono      text not null,
  nombre        text,
  estado        text not null default 'pendiente',  -- pendiente | enviado | fallido
  -- Las variables ya resueltas para este contacto, en orden ({{1}}, {{2}}…).
  -- Se calculan al armar la campaña: así el envío no depende de que el
  -- contacto no haya cambiado en el medio, y la vista previa es exacta.
  parametros    jsonb not null default '[]'::jsonb,
  error         text,
  wa_message_id text,                               -- id que devuelve Meta
  enviado_at    timestamptz,
  respondido_at timestamptz,                        -- se llena solo cuando el cliente contesta
  created_at    timestamptz not null default now(),
  unique (campania_id, contacto_id)
);

create index if not exists campania_envios_camp_idx   on public.campania_envios (campania_id, estado);
create index if not exists campania_envios_cont_idx   on public.campania_envios (contacto_id);
create index if not exists campania_envios_pend_idx   on public.campania_envios (campania_id) where estado = 'pendiente';
create index if not exists campanias_created_idx      on public.campanias (created_at desc);

-- ---------- 4. DETECTAR RESPUESTAS ----------
-- Cuando entra un mensaje de un cliente, marcamos como "respondió" el
-- envío más reciente que le hicimos, siempre que la promo haya salido
-- antes del mensaje y todavía no le hubiéramos anotado respuesta.
create or replace function public.fn_marcar_respuesta_campania()
returns trigger language plpgsql security definer as $$
begin
  if new.direccion <> 'in' then return new; end if;

  update public.campania_envios e
     set respondido_at = new.created_at
   where e.id = (
     select e2.id
       from public.campania_envios e2
      where e2.contacto_id   = new.contacto_id
        and e2.estado        = 'enviado'
        and e2.respondido_at is null
        and e2.enviado_at    <= new.created_at
        -- Sólo cuenta como respuesta a la promo si contestó dentro de la semana.
        and e2.enviado_at    >= new.created_at - interval '7 days'
      order by e2.enviado_at desc
      limit 1
   );
  return new;
end $$;

drop trigger if exists trg_respuesta_campania on public.mensajes;
create trigger trg_respuesta_campania after insert on public.mensajes
  for each row execute function public.fn_marcar_respuesta_campania();

-- ---------- 5. CONTADORES DE LA CAMPAÑA ----------
-- Mantiene enviados/fallidos al día sin que el navegador tenga que contar.
create or replace function public.fn_contar_envios()
returns trigger language plpgsql security definer as $$
begin
  if new.estado is distinct from old.estado then
    update public.campanias c
       set enviados = (select count(*) from public.campania_envios where campania_id = c.id and estado = 'enviado'),
           fallidos = (select count(*) from public.campania_envios where campania_id = c.id and estado = 'fallido')
     where c.id = new.campania_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_contar_envios on public.campania_envios;
create trigger trg_contar_envios after update on public.campania_envios
  for each row execute function public.fn_contar_envios();

-- ---------- 6. SEGURIDAD ----------
alter table public.plantillas_wa   enable row level security;
alter table public.campanias       enable row level security;
alter table public.campania_envios enable row level security;

drop policy if exists "auth_plantillas" on public.plantillas_wa;
create policy "auth_plantillas" on public.plantillas_wa
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_campanias" on public.campanias;
create policy "auth_campanias" on public.campanias
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_campania_envios" on public.campania_envios;
create policy "auth_campania_envios" on public.campania_envios
  for all to authenticated using (true) with check (true);

-- ---------- 7. TIEMPO REAL ----------
-- Para que la pantalla de la campaña se mueva sola mientras sale el envío.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campanias'
  ) then
    alter publication supabase_realtime add table public.campanias;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campania_envios'
  ) then
    alter publication supabase_realtime add table public.campania_envios;
  end if;
end $$;

-- ---------- 8. VERIFICACIÓN ----------
select 'plantillas_wa' as tabla, count(*) from public.plantillas_wa
union all select 'campanias', count(*) from public.campanias
union all select 'campania_envios', count(*) from public.campania_envios;

-- ============================================================
-- SINCRONIZACIÓN CON META (agregado después)
-- ------------------------------------------------------------
-- Estas dos columnas las usa el botón "Sincronizar con Meta" de
-- Promociones. Se pueden correr aunque ya hayas ejecutado todo
-- lo de arriba: no rompen nada.
-- ============================================================
alter table public.plantillas_wa add column if not exists estado_meta     text;
alter table public.plantillas_wa add column if not exists sincronizada_at timestamptz;

comment on column public.plantillas_wa.estado_meta is
  'Estado que reporta Meta: APPROVED, PENDING, REJECTED, PAUSED. Sólo las APPROVED se pueden mandar.';
