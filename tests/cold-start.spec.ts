import { expect, test } from '@playwright/test';
const userId = '33333333-3333-4333-8333-333333333333';
const category = {
  id: 'food',
  user_id: userId,
  name: 'Продукты',
  icon: 'basket',
  color: '#589e52',
  archived: false,
};
function cachedSession() {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: expiry }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  return {
    access_token: token,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_at: expiry,
    user: {
      id: userId,
      email: 'family@example.invalid',
      aud: 'authenticated',
      role: 'authenticated',
    },
  };
}

test('cold start waits for both account tables and shows no login or unfinished app', async ({
  page,
}) => {
  await page.addInitScript((value) => {
    localStorage.setItem('sb-potracheno-test-auth-token', JSON.stringify(value));
    localStorage.setItem('vmeste.device', 'Тест');
  }, cachedSession());
  let releaseCategories!: () => void, releaseExpenses!: () => void;
  const categoriesGate = new Promise<void>((r) => (releaseCategories = r));
  const expensesGate = new Promise<void>((r) => (releaseExpenses = r));
  let requests = 0;
  await page.route('**/rest/v1/**', async (route) => {
    requests++;
    if (route.request().url().includes('/categories')) {
      await categoriesGate;
      await route.fulfill({ json: [category] });
    } else {
      await expensesGate;
      await route.fulfill({ json: [] });
    }
  });
  await page.goto('/');
  const splash = page.getByRole('status', { name: 'Загружаем приложение', exact: true });
  await expect(splash).toBeVisible();
  await expect.poll(() => requests).toBe(2);
  await expect(page.getByRole('button', { name: 'Открыть деморежим' })).toHaveCount(0);
  await expect(page.locator('.app-shell')).toHaveCount(0);
  releaseCategories();
  await expect(splash).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveCount(0);
  releaseExpenses();
  await expect(splash).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Продукты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('group', { name: 'Цифровая клавиатура' })).toBeVisible();
});

test('initial data failure offers retry on the startup screen and then opens a ready app', async ({
  page,
}) => {
  await page.addInitScript((value) => {
    localStorage.setItem('sb-potracheno-test-auth-token', JSON.stringify(value));
    localStorage.setItem('vmeste.device', 'Тест');
  }, cachedSession());
  let fail = true;
  await page.route('**/rest/v1/**', async (route) => {
    if (fail) await route.fulfill({ status: 403, json: { message: 'Нет доступа к данным.' } });
    else
      await route.fulfill({
        json: route.request().url().includes('/categories') ? [category] : [],
      });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Нет доступа к данным.');
  await expect(page.locator('.app-shell')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Продукты', exact: true })).toBeVisible();
  await expect(page.locator('.startup-screen')).toHaveCount(0);
});
