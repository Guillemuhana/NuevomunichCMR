-- Aplicar UNA SOLA VEZ: nueva tanda de cinco intentos.
BEGIN;

-- ============================================================
-- CLIENTES POTENCIALES — 5 búsquedas de prueba
-- Definición actual; no reinicia consumos existentes.
-- Para habilitar una nueva tanda de cinco, aplicar UNA VEZ
-- supabase/migrations/20260930_prospectos_cinco.sql.
-- ------------------------------------------------------------
-- La pestaña se abre para que Cristian la pruebe, pero cada
-- búsqueda gasta créditos de Google Maps y de la IA: le tocan
-- cinco y después le vuelve el candado, para que nos escriba.
--
-- El contador va en la base y no en el navegador: borrar la
-- caché o entrar desde el celular no regala cinco más.
--
-- El cupo se reserva antes de llamar al buscador: los intentos
-- fallidos también consumen una búsqueda.
--
-- El número también está en PROSPECTOS_PRUEBAS (src/lib.js): si se
-- cambia acá, cambiarlo allá para que los carteles digan lo mismo.
-- ============================================================

create table if not exists public.prospectos_prueba (
  email          text primary key,
  usadas         integer not null default 0,
  limite         integer not null default 5,
  actualizado_at timestamptz not null default now()
);

alter table public.prospectos_prueba alter column limite set default 5;
update public.prospectos_prueba set limite = 5 where limite <> 5;

-- Nadie toca la tabla con la clave pública: se entra sólo por las
-- funciones de abajo, que son SECURITY DEFINER.
alter table public.prospectos_prueba enable row level security;

-- ---------- Cuántas lleva usadas ----------
create or replace function public.prospectos_estado(p_email text)
returns table (usadas integer, limite integer)
language sql security definer set search_path = public, pg_temp as $$
  select coalesce((select p.usadas from public.prospectos_prueba p where p.email = lower(p_email)), 0),
         5
   where lower(p_email) = lower(auth.jwt() ->> 'email');
$$;

-- ---------- Gastar una búsqueda ----------
-- Devuelve permitido = false cuando ya no quedan, sin sumar de más.
create or replace function public.prospectos_consumir(p_email text)
returns table (usadas integer, limite integer, permitido boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email  text := lower(p_email);
  v_usadas integer;
  v_limite integer;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt() ->> 'email', '')) <> coalesce(v_email, '') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  insert into public.prospectos_prueba (email) values (v_email)
  on conflict (email) do nothing;

  select p.usadas, p.limite into v_usadas, v_limite
    from public.prospectos_prueba p where p.email = v_email for update;

  if v_usadas >= 5 then
    return query select v_usadas, 5, false;
    return;
  end if;

  update public.prospectos_prueba p
     set usadas = p.usadas + 1, actualizado_at = now()
   where p.email = v_email
  returning p.usadas, p.limite into v_usadas, v_limite;

  return query select v_usadas, 5, true;
end $$;

-- Las llama el CRM con sesión iniciada; con la clave pública, no.
revoke execute on function public.prospectos_estado(text) from public, anon;
revoke execute on function public.prospectos_consumir(text) from public, anon;
grant  execute on function public.prospectos_estado(text) to authenticated;
grant  execute on function public.prospectos_consumir(text) to authenticated;

-- Reiniciar el cupo al habilitar esta nueva tanda.
UPDATE public.prospectos_prueba SET usadas = 0, limite = 5, actualizado_at = now();

COMMIT;
