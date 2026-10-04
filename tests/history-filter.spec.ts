import { expect, test } from '@playwright/test';

test('history category multiselect filters monthly rows and total, and clears back to all categories', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    const categories = ['Продукты', 'Кафе', 'Подарки'].map((name, i) => ({
      id: String(i),
      user_id: 'demo',
      name,
      icon: 'other',
      color: '#735bd2',
      archived: false,
    }));
    const entries = [
      ['0', 10000, `${month}-01`],
      ['0', 20000, `${month}-02`],
      ['1', 50000, `${month}-03`],
      ['0', 90000, `${previousMonth}-01`],
    ] as const;
    localStorage.setItem(
      'vmeste.demo.v1',
      JSON.stringify({
        categories,
        expenses: entries.map(([category_id, amount_kopecks, spent_on], i) => ({
          id: String(i),
          user_id: 'demo',
          category_id,
          amount_kopecks,
          spent_on,
          created_at: new Date().toISOString(),
          device_name: 'Тест',
          note: '',
        })),
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  const nav = (name: string) =>
    page
      .getByRole('navigation', { name: 'Мобильная навигация' })
      .getByRole('button', { name, exact: true });
  await nav('История').click();
  const filter = page.getByRole('button', { name: 'Фильтр категорий', exact: true });
  const options = page.getByRole('group', { name: 'Категории для фильтра' });
  await expect(filter).toHaveText('Все категории');
  await expect(page.getByRole('button', { name: 'Сбросить фильтр', exact: true })).toHaveCount(0);
  await expect(page.locator('.expense-row')).toHaveCount(3);
  await expect(page.locator('.period-total')).toHaveText('800 ₽');
  await filter.click();
  await expect(options.getByRole('checkbox')).toHaveCount(3);
  for (const checkbox of await options.getByRole('checkbox').all())
    await expect(checkbox).not.toBeChecked();
  await options.getByRole('checkbox', { name: 'Продукты', exact: true }).check();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await expect(page.locator('.period-total')).toHaveText('300 ₽');
  await expect(options.getByRole('checkbox', { name: 'Продукты', exact: true })).toHaveCSS(
    'outline-style',
    'none',
  );
  const apply = options.getByRole('button', { name: 'Применить', exact: true });
  await expect(apply).toHaveCSS('height', '42px');
  await expect(apply).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(apply.locator('svg')).toHaveCount(0);
  await apply.click();
  await expect(options).not.toBeVisible();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await filter.click();
  await expect(options.getByRole('checkbox', { name: 'Продукты', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Сбросить фильтр', exact: true })).toBeVisible();
  await expect(options.getByRole('checkbox', { name: 'Продукты', exact: true })).toHaveCSS(
    'border-top-width',
    '0px',
  );
  await options.getByRole('checkbox', { name: 'Кафе', exact: true }).check();
  await expect(page.locator('.expense-row')).toHaveCount(3);
  await expect(filter).toHaveText('Категорий: 2');
  await options.getByRole('checkbox', { name: 'Продукты', exact: true }).uncheck();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await expect(page.locator('.period-total')).toHaveText('500 ₽');
  await options.getByRole('checkbox', { name: 'Кафе', exact: true }).uncheck();
  await expect(filter).toHaveText('Все категории');
  await expect(page.locator('.expense-row')).toHaveCount(3);
  await options.getByRole('checkbox', { name: 'Подарки', exact: true }).check();
  await expect(page.locator('.expense-row')).toHaveCount(0);
  await expect(page.locator('.period-total')).toHaveText('0 ₽');
  await expect(
    page.getByText('Нет трат в выбранных категориях за этот месяц.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтр', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(3);
  await filter.click();
  await options.getByRole('checkbox', { name: 'Продукты', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(options).not.toBeVisible();
  await expect(filter).toBeFocused();
  await page.getByRole('button', { name: 'Предыдущий месяц', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await expect(page.locator('.period-total')).toHaveText('900 ₽');
  await nav('Потрачено').click();
  await expect(page.locator('.summary-total strong')).toHaveText('800 ₽');
  await expect(filter).toHaveCount(0);
  await nav('История').click();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await page.locator('.expense-edit-button').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Кафе', exact: true }).click();
  await dialog.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await expect(page.locator('.period-total')).toHaveText('100 ₽');
  await filter.click();
  await page.locator('.screen-title').click();
  await expect(options).not.toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await filter.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await filter.click();
  }
});
