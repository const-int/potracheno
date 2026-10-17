-- Run once in a NEW Supabase project's SQL Editor. No server code is required.
begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null default '#527961' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'other' check (icon in ('basket','shop','car','heart','paw','home','coffee','other','fuel','transport','food','clothes','travel','study','sport','gifts','fun','bills','phone','work','star','bike','lightning','puzzle','compass','lightbulb','book','palette','tools','gamepad','diamond','sparkles','hexagon','cube','clover')),
  archived boolean not null default false,
  sort_order integer check (sort_order >= 0),
  unique (user_id, name),
  unique (id, user_id)
);
create unique index categories_name_case_insensitive on public.categories(user_id, lower(trim(name)));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null,
  amount_kopecks bigint not null check (amount_kopecks between 1 and 99999999999),
  spent_on date not null default current_date check (spent_on between '1900-01-01' and '2100-12-31'),
  note text not null default '' check (length(note) <= 500),
  device_name text not null check (length(trim(device_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (category_id, user_id) references public.categories(id, user_id)
);
create index expenses_user_date on public.expenses(user_id, spent_on desc);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
revoke all on public.categories, public.expenses from anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create policy categories_select on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_delete on public.categories for delete to authenticated using ((select auth.uid()) = user_id);
create policy expenses_select on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_delete on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

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

create index if not exists expenses_deleted_at on public.expenses(deleted_at) where deleted_at is not null;

-- Use server time for deletion and enforce the deadline even for direct API updates.
create or replace function public.guard_expense_trash()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then raise exception 'Новую трату нельзя сразу поместить в корзину.'; end if;
  elsif old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := now();
  elsif old.deleted_at is not null then
    if old.deleted_at <= now() - interval '30 days' then
      raise exception 'Срок восстановления траты истёк.';
    end if;
    if new.deleted_at is not null then new.deleted_at := old.deleted_at; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists expenses_trash_guard on public.expenses;
create trigger expenses_trash_guard before insert or update on public.expenses
for each row execute function public.guard_expense_trash();

create or replace function public.trash_expense(expense_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.expenses set deleted_at = now()
  where id = expense_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Трата уже удалена или недоступна.'; end if;
end;
$$;
create or replace function public.restore_expense(expense_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.expenses set deleted_at = null
  where id = expense_id and user_id = auth.uid() and deleted_at > now() - interval '30 days';
  if not found then raise exception 'Трата недоступна или срок восстановления истёк.'; end if;
end;
$$;
revoke all on function public.trash_expense(uuid), public.restore_expense(uuid) from public, anon;
grant execute on function public.trash_expense(uuid), public.restore_expense(uuid) to authenticated;

commit;

-- For scheduled trash cleanup, also run migrations/20261017_trash_cleanup.sql.
