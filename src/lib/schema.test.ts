import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { categoryIconLabels } from './model';

it('executes the real SQL schema and access tests against embedded PostgreSQL', async () => {
  const db = new PGlite();
  try {
    // Substitute only Supabase-managed auth helpers; use real Postgres constraints and RLS.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `);
    await db.exec(await readFile(new URL('../../supabase/schema.sql', import.meta.url), 'utf8'));
    // Reproduce the original eight-icon constraint, then verify the real migration.
    await db.exec(`
      alter table public.categories drop constraint categories_icon_check;
      alter table public.categories add constraint categories_icon_check check (icon in ('basket','shop','car','heart','paw','home','coffee','other'));
      insert into auth.users(id,email) values ('33333333-3333-4333-8333-333333333333','icon-test@example.invalid');
      insert into public.categories(user_id,name,icon) values ('33333333-3333-4333-8333-333333333333','Existing category','basket');
    `);
    await db.exec(
      await readFile(
        new URL('../../supabase/migrations/20261003_expand_category_icons.sql', import.meta.url),
        'utf8',
      ),
    );
    expect(
      (
        await db.query<{ icon: string }>(
          "select icon from public.categories where name='Existing category'",
        )
      ).rows[0].icon,
    ).toBe('basket');
    for (const icon of Object.keys(categoryIconLabels)) {
      await db.query(
        "insert into public.categories(user_id,name,icon) values ('33333333-3333-4333-8333-333333333333',$1,$2)",
        ['Icon ' + icon, icon],
      );
    }
    await expect(
      db.query(
        "insert into public.categories(user_id,name,icon) values ('33333333-3333-4333-8333-333333333333','Invalid icon','unknown-icon')",
      ),
    ).rejects.toThrow();
    await db.exec(
      await readFile(new URL('../../supabase/tests/access.sql', import.meta.url), 'utf8'),
    );
    const rows = await db.query<{ count: number }>('select count(*)::int from public.expenses');
    expect(rows.rows[0].count).toBe(0);
  } finally {
    await db.close();
  }
}, 20000);
