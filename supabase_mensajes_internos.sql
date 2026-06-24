-- ============================================================
-- MENSAJERÍA INTERNA entre usuarios del CRM
-- (vendedores, administración y Cristian). Ejecutar en Supabase.
-- ============================================================

create table if not exists mensajes_internos (
  id          uuid primary key default gen_random_uuid(),
  de_key      text not null,          -- quién envía: alias de vendedor | 'administracion' | 'cristian'
  de_nombre   text,                   -- nombre legible del que envía
  para_key    text not null,          -- a quién: alias de vendedor | 'administracion' | 'cristian'
  texto       text not null,
  leido       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_mi_part  on mensajes_internos (de_key, para_key, created_at);
create index if not exists idx_mi_inbox on mensajes_internos (para_key, leido);

-- RLS: cualquier usuario autenticado del CRM puede usar la mensajería interna
alter table mensajes_internos enable row level security;
drop policy if exists "auth_full_mi" on mensajes_internos;
create policy "auth_full_mi" on mensajes_internos
  for all to authenticated using (true) with check (true);

-- Realtime para que los mensajes lleguen al instante
alter publication supabase_realtime add table mensajes_internos;
