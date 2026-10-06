import { expect, test } from '@playwright/test';

test('login keeps the shared credentials and saves a personal name after success', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const category = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: userId,
    name: 'Продукты',
    color: '#527961',
    icon: 'basket',
    archived: false,
  };
  let attempts = 0;
  let credentials: Record<string, unknown> = {};
  const expenses: Record<string, unknown>[] = [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      user_id: userId,
      category_id: category.id,
      amount_kopecks: 50000,
      spent_on: '2026-01-01',
      note: 'Старая трата',
      device_name: 'Анна',
      created_at: '2026-01-01T12:00:00Z',
    },
  ];
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Иван'));
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    credentials = route.request().postDataJSON();
    attempts++;
    if (attempts === 1) {
      await route.fulfill({
        status: 400,
        json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
      });
      return;
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(
        JSON.stringify({
          sub: userId,
          role: 'authenticated',
          aud: 'authenticated',
          exp: expiresAt,
        }),
      ).toString('base64url'),
      'test-signature',
    ].join('.');
    await route.fulfill({
      json: {
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
      },
    });
  });
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().url().includes('/categories')) {
      await route.fulfill({ json: [category] });
      return;
    }
    if (route.request().method() === 'POST') {
      expenses.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: [] });
    } else {
      await route.fulfill({ json: expenses });
    }
  });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('family@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password');
  await page.getByLabel('Имя пользователя', { exact: true }).fill('  Анна  ');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Проверьте email и пароль.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vmeste.device'))).toBe('Иван');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('group', { name: 'Цифровая клавиатура' }).waitFor();
  expect(await page.evaluate(() => localStorage.getItem('vmeste.device'))).toBe('Анна');
  expect(credentials).toMatchObject({ email: 'family@example.invalid', password: 'test-password' });
  expect(credentials).not.toHaveProperty('display_name');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const nameField = page.getByRole('dialog').getByLabel('Имя пользователя', { exact: true });
  await expect(nameField).toHaveValue('Анна');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Выйти', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Очистить имя', exact: true }).click();
  await expect(nameField).toHaveValue('');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Выйти', exact: true }),
  ).toHaveCount(0);
  await expect(nameField).toBeFocused();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
  await nameField.fill('   ');
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
  await nameField.fill('  Мария  ');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(nameField).toHaveValue('Мария');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Выйти', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('vmeste.device'))).toBe('Мария');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  const keypad = page.getByRole('group', { name: 'Цифровая клавиатура' });
  await keypad.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await keypad.getByRole('button', { name: 'Сохранить трату' }).click();
  await expect(page.locator('.app-toast-expense .app-toast-message')).toBeVisible();
  expect(expenses).toHaveLength(2);
  expect(expenses[0].device_name).toBe('Анна');
  expect(expenses[1]).toMatchObject({ user_id: userId, device_name: 'Мария', amount_kopecks: 100 });
});

test('a blank personal name cannot start authentication', async ({ page }) => {
  let attempts = 0;
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    attempts++;
    await route.abort();
  });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('family@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password');
  await page.getByLabel('Имя пользователя', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByText('Укажите свое имя.', { exact: true })).toBeVisible();
  expect(attempts).toBe(0);
});
