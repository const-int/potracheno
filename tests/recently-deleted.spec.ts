import { expect, test, type Page } from '@playwright/test';
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name, exact: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('vmeste.demo.v1')) return;
    const now = new Date();
    const date = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const today = date(now),
      yesterday = date(new Date(now.getTime() - 86400000));
    const categories = [
      {
        id: 'food',
        user_id: 'demo',
        name: 'Продукты',
        icon: 'basket',
        color: '#589e52',
        archived: false,
      },
      { id: 'home', user_id: 'demo', name: 'Дом', icon: 'home', color: '#8c55c6', archived: false },
    ];
    const base = {
      user_id: 'demo',
      device_name: 'Костя',
      created_at: now.toISOString(),
      note: '',
      deleted_at: null,
    };
    const expenses = [
      {
        ...base,
        id: 'active',
        category_id: 'food',
        amount_kopecks: 123450,
        spent_on: today,
        note: 'Сегодняшняя покупка',
      },
      { ...base, id: 'other', category_id: 'home', amount_kopecks: 80000, spent_on: yesterday },
      {
        ...base,
        id: 'trash-yesterday',
        category_id: 'food',
        amount_kopecks: 222200,
        spent_on: yesterday,
        note: 'Удалено вчера',
        deleted_at: new Date(now.getTime() - 86400000).toISOString(),
      },
      {
        ...base,
        id: 'trash-today',
        category_id: 'home',
        amount_kopecks: 333300,
        spent_on: today,
        note: 'Удалено сегодня',
        deleted_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
      },
      {
        ...base,
        id: 'expired',
        category_id: 'food',
        amount_kopecks: 444400,
        spent_on: yesterday,
        deleted_at: new Date(now.getTime() - 31 * 86400000).toISOString(),
      },
    ];
    localStorage.setItem('vmeste.device', 'Костя');
    localStorage.setItem('vmeste.demo.v1', JSON.stringify({ categories, expenses }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
});

test('deleted records are excluded from totals/export, grouped like history, and restored intact', async ({
  page,
}) => {
  await nav(page, 'Потрачено').click();
  await expect(page.locator('.summary-total strong')).toHaveText('2,035 ₽');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт трат в CSV', exact: true }).click();
  const stream = await (await download).createReadStream();
  let text = '';
  for await (const chunk of stream!) text += chunk.toString();
  expect(text).toContain('Сегодняшняя покупка');
  expect(text).not.toContain('Удалено');
  expect(text).not.toContain('4444.00');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await nav(page, 'История').click();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await expect(page.locator('.history-day-label')).toHaveText(['Сегодня', 'Вчера']);
  const original = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.find(
      (e: { id: string }) => e.id === 'active',
    ),
  );
  const row = page.locator('.expense-row').filter({ hasText: 'Сегодняшняя покупка' });
  await row.getByRole('button').click();
  await page.getByRole('button', { name: 'Удалить трату', exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator('.period-total')).toHaveText('800 ₽');
  await nav(page, 'Потрачено').click();
  await expect(page.locator('.summary-total strong')).toHaveText('800 ₽');
  await nav(page, 'История').click();
  await page.getByRole('button', { name: 'Недавно удаленные', exact: true }).click();
  await expect(page.locator('.screen-title')).toHaveText('Недавно удаленные');
  await expect(page.locator('.expense-row')).toHaveCount(3);
  await expect(page.locator('.history-day-label')).toHaveText(['Сегодня', 'Вчера']);
  await expect(page.locator('.month-switch, .history-filter-row')).toHaveCount(0);
  await expect(page.locator('.expense-row .lucide-trash-restore')).toHaveCount(3);
  const restore = page
    .locator('.expense-row')
    .filter({ hasText: 'Сегодняшняя покупка' })
    .getByRole('button');
  const restoreSize = await restore.evaluate((button) => ({
    width: button.getBoundingClientRect().width,
    height: button.getBoundingClientRect().height,
  }));
  expect(restoreSize.width).toBeCloseTo(32, 2);
  expect(restoreSize.height).toBeCloseTo(32, 2);
  await restore.click();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await expect(page.getByRole('status')).toContainText('Трата восстановлена');
  const restored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.find(
      (e: { id: string }) => e.id === 'active',
    ),
  );
  expect(restored).toEqual(original);
  await page.getByRole('button', { name: 'Вернуться к истории', exact: true }).click();
  await expect(page.locator('.period-total')).toHaveText('2,035 ₽');
  await expect(row).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await nav(page, 'История').click();
  await expect(row).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.some(
        (e: { id: string }) => e.id === 'expired',
      ),
    ),
  ).toBe(false);
});

test('trash is independent of history category filters and closes when leaving the tab', async ({
  page,
}) => {
  await nav(page, 'История').click();
  await page.getByRole('button', { name: 'Фильтр категорий', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Дом', exact: true }).check();
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Недавно удаленные', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(2);
  await nav(page, 'Трата').click();
  await nav(page, 'История').click();
  await expect(page.locator('.screen-title')).toHaveText('История трат');
  await expect(page.locator('.expense-row')).toHaveCount(1);
});

test('touch header buttons release their background after opening and closing trash', async ({
  page,
}) => {
  await nav(page, 'История').click();
  await page.getByRole('button', { name: 'Недавно удаленные', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Вернуться к истории', exact: true })).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await page.getByRole('button', { name: 'Вернуться к истории', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Недавно удаленные', exact: true })).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
});
