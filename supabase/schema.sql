-- Run once in a NEW Supabase project's SQL Editor. No server code is required.
begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  color text not null default '#527961' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'other' check (icon in ('basket','shop','car','heart','paw','home','coffee','other')),
  archived boolean not null default false,
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
  foreign key (category_id, user_id) references public.categories(id, user_id)
);
create index expenses_user_date on public.expenses(user_id, spent_on desc);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
revoke all on public.categories, public.expenses from anon, authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

create policy categories_select on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_select on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert on public.expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update on public.expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expenses_delete on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

commit;
