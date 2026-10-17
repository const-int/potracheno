import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('enforces owner-only trash/restore and the 30-day deadline in PostgreSQL', async () => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111',
    b = '22222222-2222-4222-8222-222222222222';
  const category = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    foreignCategory = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const own = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    foreign = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
    // Verify upgrading the original schema and rerunning the migration without losing data.
    await db.exec(`drop trigger expenses_trash_guard on public.expenses; alter table public.expenses drop column deleted_at;
      insert into auth.users values ('${a}'),('${b}');
      insert into public.categories(id,user_id,name) values ('${category}','${a}','Дом'),('${foreignCategory}','${b}','Чужая');
      insert into public.expenses(id,user_id,category_id,amount_kopecks,spent_on,note,device_name) values
        ('${own}','${a}','${category}',123456,'2026-09-02','Комментарий','Автор'),
        ('${foreign}','${b}','${foreignCategory}',999,'2026-09-03','','Другой');`);
    const migration = await readFile(
      new URL('../../supabase/migrations/20261017_recently_deleted.sql', import.meta.url),
      'utf8',
    );
    const snapshot = async () =>
      (
        await db.query(
          "select to_jsonb(e) - 'deleted_at' as record from public.expenses e order by id",
        )
      ).rows;
    const originalRecords = await snapshot();
    await db.exec(migration);
    await db.exec(migration);
    expect(await snapshot()).toEqual(originalRecords);
    expect(
      (
        await db.query(
          'select count(*)::int as count from public.expenses where deleted_at is not null',
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    const before = (
      await db.query(
        `select amount_kopecks,spent_on,note,device_name,created_at,category_id from public.expenses where id='${own}'`,
      )
    ).rows;
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    await expect(db.exec(`select public.trash_expense('${foreign}');`)).rejects.toThrow(
      'недоступна',
    );
    await db.exec(`select public.trash_expense('${own}');`);
    expect(
      (
        await db.query(
          `select deleted_at is not null as deleted from public.expenses where id='${own}'`,
        )
      ).rows,
    ).toEqual([{ deleted: true }]);
    await expect(
      db.exec(`delete from public.categories where id='${category}';`),
    ).rejects.toThrow();
    await db.exec(`select public.restore_expense('${own}');`);
    expect(
      (
        await db.query(
          `select amount_kopecks,spent_on,note,device_name,created_at,category_id from public.expenses where id='${own}'`,
        )
      ).rows,
    ).toEqual(before);
    await db.exec(`reset role; alter table public.expenses disable trigger expenses_trash_guard;
      update public.expenses set deleted_at=now()-interval '30 days' where id='${own}';
      alter table public.expenses enable trigger expenses_trash_guard;
      set role authenticated; set request.jwt.claim.sub='${a}';`);
    await expect(db.exec(`select public.restore_expense('${own}');`)).rejects.toThrow('истёк');
    await expect(
      db.exec(`update public.expenses set deleted_at=null where id='${own}';`),
    ).rejects.toThrow('истёк');
    await db.exec('reset role; set role anon;');
    await expect(db.exec(`select public.restore_expense('${own}');`)).rejects.toThrow();
    // Safety matrix: old purchase dates must not matter; only deletion time counts.
    const recent = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const oldActive = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const oldTrash = '99999999-9999-4999-8999-999999999999';
    await db.exec(`reset role;
      alter table public.expenses disable trigger expenses_trash_guard;
      insert into public.expenses(id,user_id,category_id,amount_kopecks,spent_on,note,device_name,created_at,deleted_at) values
        ('${recent}','${a}','${category}',100,'1900-01-01','Still recoverable','A','1900-01-01',now()-interval '30 days'+interval '1 minute'),
        ('${oldActive}','${a}','${category}',200,'1900-01-01','Old active purchase','A','1900-01-01',null),
        ('${oldTrash}','${a}','${category}',300,'1900-01-01','Expired trash','A','1900-01-01',now()-interval '31 days');
      alter table public.expenses enable trigger expenses_trash_guard;`);
    const survivorsBefore = (
      await db.query(
        `select * from public.expenses where id in ('${foreign}','${recent}','${oldActive}') order by id`,
      )
    ).rows;
    const cleanup = await readFile(
      new URL('../../supabase/migrations/20261017_trash_cleanup.sql', import.meta.url),
      'utf8',
    );
    const scheduledSql = cleanup.match(/\$\$([\s\S]*?)\$\$/)?.[1];
    expect(scheduledSql).toBeTruthy();
    await db.exec(scheduledSql!);
    expect((await db.query('select id from public.expenses order by id')).rows).toEqual([
      { id: foreign },
      { id: recent },
      { id: oldActive },
    ]);
    expect((await db.query('select * from public.expenses order by id')).rows).toEqual(
      survivorsBefore,
    );
    expect((await db.query('select count(*)::int as count from public.categories')).rows).toEqual([
      { count: 2 },
    ]);
  } finally {
    await db.close();
  }
}, 20000);
