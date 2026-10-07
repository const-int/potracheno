import { expect, test, type Page } from '@playwright/test';

const userId = '33333333-3333-4333-8333-333333333333';
function session(expiresAt: number) {
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  return {
    access_token: token,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId,
      email: 'family@example.invalid',
      aud: 'authenticated',
      role: 'authenticated',
    },
  };
}
async function prepare(page: Page) {
  await page.clock.install();
  await page.addInitScript(
    ({ value }) => {
      localStorage.setItem('sb-potracheno-test-auth-token', JSON.stringify(value));
      localStorage.setItem('vmeste.device', 'Тест');
    },
    { value: session(Math.floor(Date.now() / 1000) - 100) },
  );
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
}

test('stalled session restoration leaves a recoverable error and a late response still opens the account', async ({
  page,
}) => {
  await prepare(page);
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/auth/v1/token**', async (route) => {
    requested = true;
    await gate;
    await route.fulfill({ json: session(Math.floor(Date.now() / 1000) + 3600) });
  });
  await page.goto('/');
  await expect(page.getByText('Проверяем вход…', { exact: true })).toBeVisible();
  await expect.poll(() => requested).toBe(true);
  await page.clock.fastForward(5001);
  await expect(page.getByText('Проверяем вход…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Не удалось проверить вход');
  await expect(page.getByRole('button', { name: 'Повторить проверку', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('sb-potracheno-test-auth-token')),
  ).not.toBeNull();
  release();
  await expect(page.getByRole('group', { name: 'Цифровая клавиатура' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Повторить проверку', exact: true })).toHaveCount(
    0,
  );
});

test('retry reloads a stalled client and restores the saved account without asking for credentials', async ({
  page,
}) => {
  await prepare(page);
  let requests = 0;
  await page.route('**/auth/v1/token**', async (route) => {
    requests++;
    if (requests === 1) await new Promise<void>(() => {});
    else await route.fulfill({ json: session(Math.floor(Date.now() / 1000) + 3600) });
  });
  await page.goto('/');
  await expect.poll(() => requests).toBe(1);
  await page.clock.fastForward(5001);
  await page.getByRole('button', { name: 'Повторить проверку', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Цифровая клавиатура' })).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => localStorage.getItem('vmeste.device'))).toBe('Тест');
});
