import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

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
    await db.exec(
      await readFile(new URL('../../supabase/tests/access.sql', import.meta.url), 'utf8'),
    );
    const rows = await db.query<{ count: number }>('select count(*)::int from public.expenses');
    expect(rows.rows[0].count).toBe(0);
  } finally {
    await db.close();
  }
}, 20000);
