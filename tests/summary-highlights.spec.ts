import { expect, test } from '@playwright/test';

test('summary distinguishes a daily total from one purchase and updates when the month changes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    const category = {
      id: 'food',
      user_id: 'demo',
      name: 'Продукты',
      icon: 'basket',
      color: '#589e52',
      archived: false,
    };
    const amounts = [100000, 100001, 150000, 5000000];
    const dates = [`${month}-01`, `${month}-01`, `${month}-02`, `${previousMonth}-01`];
    localStorage.setItem(
      'vmeste.demo.v1',
      JSON.stringify({
        categories: [category],
        expenses: amounts.map((amount_kopecks, index) => ({
          id: String(index),
          user_id: 'demo',
          category_id: 'food',
          amount_kopecks,
          spent_on: dates[index],
          device_name: 'Тест',
          note: '',
          created_at: new Date().toISOString(),
        })),
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Потрачено' })
    .click();
  const day = page.getByRole('region', { name: 'Самый затратный день', exact: true });
  const purchase = page.getByRole('region', { name: 'Самая крупная трата', exact: true });
  await expect(day.locator('strong')).toHaveText('2,001 ₽');
  await expect(day.locator('small')).toContainText('1 ');
  await expect(purchase.locator('strong')).toHaveText('1,500 ₽');
  await expect(purchase.locator('small')).toContainText('Продукты · 2 ');
  await expect(
    page.locator('.stat').filter({ hasText: 'Средняя трата' }).locator('strong'),
  ).toHaveText('1,167 ₽');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.compact-summary .stat:visible')).toHaveCount(4);
  }
  await page.getByRole('button', { name: 'Предыдущий месяц', exact: true }).click();
  await expect(day.locator('strong')).toHaveText('50,000 ₽');
  await expect(purchase.locator('strong')).toHaveText('50,000 ₽');
  await page.getByRole('button', { name: 'Предыдущий месяц', exact: true }).click();
  await expect(day.locator('strong')).toHaveText('—');
  await expect(purchase.locator('strong')).toHaveText('—');
  await expect(day.locator('small')).toHaveText('Нет трат');
});
