import { expect, test, type Page } from '@playwright/test';

const content =
  'Дата;Сумма;Категория;Комментарий;Автор\n02.01.2026;1500;Путешествия;Поездка;Анна\n2026-01-03;200;путешествия;Билеты;';
async function openImport(page: Page) {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Импорт расходов из CSV', exact: true }).click();
  await page.getByRole('heading', { name: 'Импорт расходов', exact: true }).waitFor();
}
async function selectFile(page: Page, text: string) {
  await page
    .getByLabel('Выберите CSV', { exact: true })
    .setInputFiles({ name: 'expenses.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
}
test('CSV preview does not mutate data, confirmation imports and reimport skips duplicates', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Алексей'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  const previous = await page.evaluate(
    () => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.length,
  );
  await openImport(page);
  await selectFile(page, content);
  await expect(page.getByRole('button', { name: 'Импортировать расходы (2)' })).toBeEnabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.length),
  ).toBe(previous);
  await expect(
    page.getByText('Будут созданы категории: Путешествия.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Импортировать расходы (2)' }).click();
  await expect(
    page.getByText('Импортировано расходов: 2. Пропущено совпадений: 0.', { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vmeste.demo.v1')!));
  expect(saved.expenses.length).toBe(previous + 2);
  expect(saved.expenses[0]).toMatchObject({
    spent_on: '2026-01-02',
    amount_kopecks: 150000,
    device_name: 'Анна',
    note: '',
  });
  expect(saved.expenses[1].device_name).toBe('Алексей');
  expect(
    saved.categories.filter((c: { name: string }) => c.name.toLowerCase() === 'путешествия'),
  ).toHaveLength(1);
  await openImport(page);
  await selectFile(page, content);
  await expect(page.getByText('Новых расходов для импорта нет.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Импортировать расходы (0)' })).toBeDisabled();
  await page.getByLabel('Пропускать уже существующие расходы', { exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Импортировать расходы (2)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.length),
  ).toBe(previous + 2);
});

test('invalid CSV rows block the entire import', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  await openImport(page);
  await selectFile(page, 'Дата;Сумма;Категория\n2026-01-01;100;Дом\n2026-02-30;0;Дом');
  await expect(page.getByRole('alert')).toContainText('Строка 3');
  await expect(page.getByRole('button', { name: /^Импортировать расходы \(/ })).toBeDisabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.length),
  ).toBe(9);
});

test('cloud import uses a batch and retry does not duplicate a committed request with a lost response', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const categories: Record<string, unknown>[] = [];
  const expenses: Record<string, unknown>[] = [];
  let lostResponse = true;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: 'test-refresh',
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
    }),
  );
  await page.route('**/rest/v1/**', async (route) => {
    const destination = route.request().url().includes('/categories') ? categories : expenses;
    if (route.request().method() === 'POST') {
      const records = route.request().postDataJSON() as Record<string, unknown>[];
      expect(Array.isArray(records)).toBe(true);
      for (const row of records)
        if (!destination.some((saved) => saved.id === row.id)) destination.push(row);
      if (destination === expenses && lostResponse) {
        lostResponse = false;
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: 201, json: [] });
    } else {
      await route.fulfill({ json: destination });
    }
  });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('family@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password');
  await page.getByLabel('Имя пользователя', { exact: true }).fill('Анна');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('group', { name: 'Цифровая клавиатура' }).waitFor();
  await openImport(page);
  await selectFile(page, 'Дата;Сумма;Категория\n2026-01-01;100;Поездки');
  await page.getByLabel('Пропускать уже существующие расходы', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Импортировать расходы (1)' }).click();
  await expect(page.getByRole('alert')).toContainText('Можно повторить попытку');
  expect(expenses).toHaveLength(1);
  await page.getByRole('button', { name: 'Импортировать расходы (1)' }).click();
  await expect(
    page.getByText('Импортировано расходов: 0. Пропущено совпадений: 1.', { exact: true }),
  ).toBeVisible();
  expect(expenses).toHaveLength(1);
  expect(categories).toHaveLength(1);
  expect(expenses[0]).toMatchObject({
    user_id: userId,
    device_name: 'Анна',
    amount_kopecks: 10000,
  });
});
