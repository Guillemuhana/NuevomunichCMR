-- ============================================================
-- Calendario de eventos — Nuevo Munich CRM
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  tipo         text not null default 'reunion',   -- reunion | visita | entrega | recordatorio | feriado
  inicio       timestamptz not null,
  fin          timestamptz,
  todo_el_dia  boolean not null default false,
  lugar        text,
  vendedor     text,                              -- alias del vendedor asignado (opcional)
  creado_por   text,                              -- email de quien lo creó
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists eventos_inicio_idx   on public.eventos (inicio);
create index if not exists eventos_vendedor_idx on public.eventos (vendedor);

-- updated_at automático
create or replace function public.eventos_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists eventos_touch on public.eventos;
create trigger eventos_touch before update on public.eventos
  for each row execute function public.eventos_touch_updated_at();

-- RLS: cualquier usuario autenticado del CRM puede ver y gestionar eventos
alter table public.eventos enable row level security;

drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos
  for select to authenticated using (true);

drop policy if exists "eventos_insert" on public.eventos;
create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (true);

drop policy if exists "eventos_update" on public.eventos;
create policy "eventos_update" on public.eventos
  for update to authenticated using (true) with check (true);

drop policy if exists "eventos_delete" on public.eventos;
create policy "eventos_delete" on public.eventos
  for delete to authenticated using (true);

-- Realtime (opcional, para que el calendario se actualice solo).
-- Se agrega sólo si todavía no está en la publicación: si no, Postgres
-- tira "relation is already member of publication" al re-correr el script.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'eventos'
  ) then
    alter publication supabase_realtime add table public.eventos;
  end if;
end $$;
