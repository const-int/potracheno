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
  await expect(page.getByLabel('Сумма траты', { exact: true })).toHaveValue('2841');
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
