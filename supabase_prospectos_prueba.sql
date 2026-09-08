-- ============================================================
-- CLIENTES POTENCIALES — 3 búsquedas de prueba
-- Ya aplicado en Supabase el 7/9/2026 (migración
-- `prospectos_prueba_tres_busquedas`). Queda acá para saber qué
-- se tocó y poder repetirlo si hay que levantar todo de cero.
-- ------------------------------------------------------------
-- La pestaña se abre para que Cristian la pruebe, pero cada
-- búsqueda gasta créditos de Google Maps y de la IA: le tocan
-- tres y después le vuelve el candado, para que nos escriba.
--
-- El contador va en la base y no en el navegador: borrar la
-- caché o entrar desde el celular no regala tres más.
--
-- PARA VENDERLE EL SERVICIO, sin tocar código ni deploy:
--   update public.prospectos_prueba
--      set limite = 100000 where email = 'cristian@...';
-- Para regalarle otra tanda de pruebas:
--   update public.prospectos_prueba
--      set usadas = 0 where email = 'cristian@...';
-- ============================================================

create table if not exists public.prospectos_prueba (
  email          text primary key,
  usadas         integer not null default 0,
  limite         integer not null default 3,
  actualizado_at timestamptz not null default now()
);

-- Nadie toca la tabla con la clave pública: se entra sólo por las
-- funciones de abajo, que son SECURITY DEFINER.
alter table public.prospectos_prueba enable row level security;

-- ---------- Cuántas lleva usadas ----------
create or replace function public.prospectos_estado(p_email text)
returns table (usadas integer, limite integer)
language sql security definer set search_path = public, pg_temp as $$
  select coalesce((select p.usadas from public.prospectos_prueba p where p.email = lower(p_email)), 0),
         coalesce((select p.limite from public.prospectos_prueba p where p.email = lower(p_email)), 3);
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
  insert into public.prospectos_prueba (email) values (v_email)
  on conflict (email) do nothing;

  select p.usadas, p.limite into v_usadas, v_limite
    from public.prospectos_prueba p where p.email = v_email for update;

  if v_usadas >= v_limite then
    return query select v_usadas, v_limite, false;
    return;
  end if;

  update public.prospectos_prueba p
     set usadas = p.usadas + 1, actualizado_at = now()
   where p.email = v_email
  returning p.usadas, p.limite into v_usadas, v_limite;

  return query select v_usadas, v_limite, true;
end $$;

-- Las llama el CRM con sesión iniciada; con la clave pública, no.
revoke execute on function public.prospectos_estado(text) from public, anon;
revoke execute on function public.prospectos_consumir(text) from public, anon;
grant  execute on function public.prospectos_estado(text) to authenticated;
grant  execute on function public.prospectos_consumir(text) to authenticated;
