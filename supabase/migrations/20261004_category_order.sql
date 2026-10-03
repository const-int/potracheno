-- Run in an existing Supabase project's SQL Editor.
begin;
alter table public.categories add column if not exists sort_order integer
  check (sort_order >= 0);

create or replace function public.reorder_categories(ordered_ids uuid[])
returns void language plpgsql security invoker set search_path = public
as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Требуется вход в аккаунт.'; end if;
  if ordered_ids is null or cardinality(ordered_ids) <> (
    select count(*) from public.categories where user_id = owner_id
  ) or cardinality(ordered_ids) <> (select count(distinct id) from unnest(ordered_ids) as ids(id))
  or exists (
    select 1 from unnest(ordered_ids) as ids(id)
    where not exists (select 1 from public.categories c where c.id = ids.id and c.user_id = owner_id)
  ) then
    raise exception 'Список категорий изменился. Обновите приложение и повторите перемещение.';
  end if;
  update public.categories c set sort_order = (ids.position - 1)::integer
  from unnest(ordered_ids) with ordinality as ids(id, position)
  where c.id = ids.id and c.user_id = owner_id;
end;
$$;
revoke all on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
commit;
