-- Run in the existing project's SQL Editor, then run 20261017_trash_cleanup.sql.
begin;
alter table public.expenses add column if not exists deleted_at timestamptz;
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
