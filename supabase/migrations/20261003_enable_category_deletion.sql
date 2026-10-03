-- Run once in an existing Supabase project's SQL Editor.
-- Expenses keep their foreign key: categories with expenses cannot be deleted.
begin;
grant delete on public.categories to authenticated;
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);
commit;
