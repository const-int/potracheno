import { expect, test } from '@playwright/test';

test('fractional expenses display rounded rubles and retain precision when editing only a date', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  const original = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    return data.expenses.find(
      (expense: { amount_kopecks: number }) => expense.amount_kopecks === 284050,
    );
  });
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  const row = page
    .locator('.expense-row')
    .filter({ has: page.locator('.expense-amount', { hasText: '2,841 ₽' }) });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Редактировать Продукты', exact: true }).click();
  await expect(page.getByLabel('Сумма траты', { exact: true })).toHaveValue('2,841');
  await page.getByLabel('Дата траты', { exact: true }).fill(original.spent_on.slice(0, 8) + '01');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.find(
          (expense: { id: string }) => expense.id === id,
        ).amount_kopecks,
      original.id,
    ),
  ).toBe(284050);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Потрачено' })
    .click();
  const expected = await page.evaluate(() => {
    const expenses = JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses;
    const total = expenses.reduce(
      (sum: number, expense: { amount_kopecks: number }) => sum + expense.amount_kopecks,
      0,
    );
    return {
      total: Math.ceil(total / 100).toLocaleString('en-US') + ' ₽',
      average: Math.ceil(total / expenses.length / 100).toLocaleString('en-US') + ' ₽',
    };
  });
  await expect(page.locator('.summary-total strong')).toHaveText(expected.total);
  await expect(
    page.locator('.stat').filter({ hasText: 'Средняя трата' }).locator('strong'),
  ).toHaveText(expected.average);
});

test('editing grouped amounts preserves the caret and saves whole rubles correctly', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Тест'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История', exact: true })
    .click();
  const row = page.locator('.expense-row').first();
  await row.getByRole('button').click();
  const amount = page.getByLabel('Сумма траты', { exact: true });
  await amount.fill('1234567');
  await expect(amount).toHaveValue('1,234,567');
  await amount.evaluate((input: HTMLInputElement) => input.setSelectionRange(3, 3));
  await amount.pressSequentially('9');
  await expect(amount).toHaveValue('12,934,567');
  expect(await amount.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(4);
  await amount.fill('1,234,567');
  await amount.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 2));
  await amount.press('Backspace');
  await expect(amount).toHaveValue('234,567');
  await amount.fill('1,234,567');
  await amount.evaluate((input: HTMLInputElement) => input.setSelectionRange(1, 1));
  await amount.press('Delete');
  await expect(amount).toHaveValue('134,567');
  await amount.fill('');
  await expect(amount).toHaveValue('');
  await amount.fill('12,345');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.expense-row').filter({ hasText: '12,345 ₽' })).toHaveCount(1);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.filter(
      (e: { amount_kopecks: number }) => e.amount_kopecks === 1234500,
    ),
  );
  expect(saved).toHaveLength(1);
});
