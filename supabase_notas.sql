-- ============================================================
-- NOTAS — el pizarrón compartido de Administración
-- Pegá esto en Supabase → SQL Editor → RUN
-- ============================================================
-- Notas y recordatorios que escribe el personal de administración.
-- Son compartidas: las ve y las edita todo el equipo, como un
-- pizarrón. Por eso guardamos quién escribió cada una.
-- ============================================================

create table if not exists public.notas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text,
  texto        text not null default '',
  color        text not null default 'gris',       -- rojo | ambar | verde | azul | gris
  fijada       boolean not null default false,     -- queda arriba de todo
  hecha        boolean not null default false,     -- tachada, ya resuelta
  recordatorio date,                               -- opcional: "acordate el…"
  autor        text,                               -- nombre de quien la creó
  autor_email  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists notas_orden_idx on public.notas (fijada desc, updated_at desc);
create index if not exists notas_recordatorio_idx on public.notas (recordatorio)
  where recordatorio is not null and hecha = false;

-- updated_at automático, para que el orden refleje la última edición
create or replace function public.notas_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notas_touch_trg on public.notas;
create trigger notas_touch_trg before update on public.notas
  for each row execute function public.notas_touch();

-- ---------- Seguridad ----------
alter table public.notas enable row level security;

drop policy if exists "auth_notas" on public.notas;
create policy "auth_notas" on public.notas
  for all to authenticated using (true) with check (true);

-- ---------- Tiempo real ----------
-- Para que si dos personas de administración están mirando el pizarrón,
-- lo que escribe una le aparezca a la otra sin recargar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'notas'
  ) then
    alter publication supabase_realtime add table public.notas;
  end if;
end $$;

-- ---------- Verificación ----------
select count(*) as notas from public.notas;
