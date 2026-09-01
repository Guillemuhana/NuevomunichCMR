-- ============================================================
-- NOTAS NUEVAS — el pizarrón ahora avisa
-- Pegá esto en Supabase → SQL Editor → RUN
-- ------------------------------------------------------------
-- Hasta ahora el pizarrón era compartido pero mudo: administración
-- escribía una nota y Cristian se enteraba sólo si se le ocurría
-- entrar a mirar. Cada nota pasa a llevar la lista de quiénes ya
-- la abrieron; lo que no está en esa lista, y no lo escribió uno
-- mismo, es una nota nueva y se avisa.
-- ============================================================

alter table public.notas
  add column if not exists leida_por text[] not null default '{}';

create index if not exists notas_leida_por_idx on public.notas using gin (leida_por);

-- ---------- updated_at: verla no es editarla ----------
-- El trigger de siempre pisaba updated_at en CUALQUIER update. Con esto,
-- abrir el pizarrón movía todas las notas al tope y le cambiaba el orden
-- al resto del equipo. Marcar visto ahora no cuenta como edición.
create or replace function public.notas_touch()
returns trigger language plpgsql as $$
begin
  if new.leida_por is distinct from old.leida_por
     and (to_jsonb(new) - 'leida_por' - 'updated_at')
       = (to_jsonb(old) - 'leida_por' - 'updated_at') then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notas_touch_trg on public.notas;
create trigger notas_touch_trg before update on public.notas
  for each row execute function public.notas_touch();

-- ---------- Marcar como vistas ----------
-- En una sola consulta y sin pisar lo que marcó otro: si dos personas
-- abren el pizarrón al mismo tiempo, ninguna borra la marca de la otra.
create or replace function public.notas_marcar_vistas(p_email text, p_ids uuid[])
returns void language sql security definer as $$
  update public.notas
     set leida_por = array_append(coalesce(leida_por, '{}'), lower(p_email))
   where id = any(p_ids)
     and not (coalesce(leida_por, '{}') @> array[lower(p_email)]);
$$;

grant execute on function public.notas_marcar_vistas(text, uuid[]) to authenticated;

-- ---------- Las viejas ya están vistas ----------
-- Sin esto, el dia que se sube el cambio le saltan como "nuevas" todas las
-- notas que el equipo ya venia leyendo hace meses. Se dan por vistas para
-- todos los que alguna vez escribieron en el pizarron, que son sus usuarios.
with usuarios as (
  select array_agg(distinct lower(autor_email)) as emails
    from public.notas where autor_email is not null and autor_email <> ''
)
update public.notas n
   set leida_por = coalesce((select emails from usuarios), '{}')
 where n.leida_por = '{}';

-- ---------- Verificación ----------
select count(*) filter (where leida_por = '{}') as sin_marcar, count(*) as notas
  from public.notas;
