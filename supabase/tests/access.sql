-- Run in SQL Editor after schema.sql. All fixtures are rolled back.
begin;
insert into auth.users(id, email) values
('11111111-1111-4111-8111-111111111111', 'vmeste-test-a@example.invalid'),
('22222222-2222-4222-8222-222222222222', 'vmeste-test-b@example.invalid');
insert into public.categories(id,user_id,name) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','RLS test A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','RLS test B');
insert into public.expenses(id,user_id,category_id,amount_kopecks,device_name) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',129,'Test A'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',250,'Test B');

set local role anon;
do $$
begin
  begin perform * from public.expenses; raise exception 'FAIL: anon read allowed'; exception when insufficient_privilege then null; end;
  begin perform * from public.categories; raise exception 'FAIL: anon category read allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.categories(name,user_id) values ('Anon','11111111-1111-4111-8111-111111111111'); raise exception 'FAIL: anon write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
do $$
declare affected integer;
begin
  if not exists (select 1 from public.expenses where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'FAIL: owner cannot read expense'; end if;
  if exists (select 1 from public.expenses where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'FAIL: foreign expense visible'; end if;
  if exists (select 1 from public.categories where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'FAIL: foreign category visible'; end if;

  insert into public.expenses(id,category_id,amount_kopecks,device_name)
  values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',29,'New device');
  update public.expenses set amount_kopecks=30 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'FAIL: owner update denied'; end if;
  update public.expenses set amount_kopecks=30 where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'FAIL: foreign update allowed'; end if;
  delete from public.expenses where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'FAIL: foreign delete allowed'; end if;

  begin
    insert into public.expenses(user_id,category_id,amount_kopecks,device_name)
    values ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'Foreign');
    raise exception 'FAIL: forged owner insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.expenses set user_id='22222222-2222-4222-8222-222222222222',category_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    raise exception 'FAIL: owner transfer allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.expenses(category_id,amount_kopecks,device_name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'Foreign category');
    raise exception 'FAIL: foreign category allowed';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.expenses(category_id,amount_kopecks,device_name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'Zero');
    raise exception 'FAIL: zero amount allowed';
  exception when check_violation then null; end;

  perform public.reorder_categories(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]);
  if (select sort_order from public.categories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>0 then raise exception 'FAIL: order not saved'; end if;
  begin
    perform public.reorder_categories(array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[]);
    raise exception 'FAIL: foreign category order changed';
  exception when raise_exception then
    if sqlerrm = 'FAIL: foreign category order changed' then raise; end if;
  end;
  begin
    perform public.reorder_categories(array[]::uuid[]);
    raise exception 'FAIL: incomplete order accepted';
  exception when raise_exception then
    if sqlerrm = 'FAIL: incomplete order accepted' then raise; end if;
  end;
  update public.categories set archived=true where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if not exists (select 1 from public.expenses where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'FAIL: archive removed expense'; end if;
  delete from public.expenses where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'FAIL: owner delete denied'; end if;
  begin delete from public.categories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; raise exception 'FAIL: category with expenses deleted'; exception when foreign_key_violation then null; end;
  delete from public.categories where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'FAIL: foreign category deletion allowed'; end if;
  insert into public.categories(id,name) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','Empty category');
  perform public.reorder_categories(array['ffffffff-ffff-4fff-8fff-ffffffffffff', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]);
  if (select sort_order from public.categories where id='ffffffff-ffff-4fff-8fff-ffffffffffff')<>0 or
    (select sort_order from public.categories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 then raise exception 'FAIL: multi-category order not saved'; end if;
  begin
    perform public.reorder_categories(array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]);
    raise exception 'FAIL: duplicate order accepted';
  exception when raise_exception then
    if sqlerrm = 'FAIL: duplicate order accepted' then raise; end if;
  end;
  if (select sort_order from public.categories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>1 then raise exception 'FAIL: rejected reorder changed data'; end if;
  delete from public.categories where id='ffffffff-ffff-4fff-8fff-ffffffffffff';
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'FAIL: owner empty category deletion denied'; end if;
end $$;
reset role;
rollback;
