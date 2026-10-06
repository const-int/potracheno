import { expect, test } from '@playwright/test';

test('period navigation stops at the first recorded month, keeps empty gaps and ignores category filters', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
  await page.addInitScript(() => {
    const categories = ['Ранние', 'Новые'].map((name, i) => ({
      id: String(i),
      name,
      user_id: 'demo',
      icon: 'other',
      color: '#735bd2',
      archived: false,
    }));
    localStorage.setItem(
      'vmeste.demo.v1',
      JSON.stringify({
        categories,
        expenses: [
          ['2026-08-01', '0'],
          ['2026-10-01', '1'],
        ].map(([spent_on, category_id], i) => ({
          id: String(i),
          user_id: 'demo',
          category_id,
          amount_kopecks: 10000,
          spent_on,
          created_at: '2026-10-06T12:00:00Z',
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
  const previous = page.getByRole('button', { name: 'Предыдущий месяц', exact: true });
  await nav('История').click();
  await page.getByRole('button', { name: 'Фильтр категорий', exact: true }).click();
  const options = page.getByRole('group', { name: 'Категории для фильтра' });
  await options.getByRole('checkbox', { name: 'Новые', exact: true }).check();
  await options.getByRole('button', { name: 'Применить', exact: true }).click();
  await previous.click();
  await expect(page.locator('.month-switch span')).toHaveText('сентябрь 2026');
  await expect(previous).toBeVisible();
  await expect(page.locator('.expense-row')).toHaveCount(0);
  await previous.click();
  await expect(page.locator('.month-switch span')).toHaveText('август 2026');
  await expect(previous).toBeDisabled();
  await page.getByRole('button', { name: 'Сбросить фильтр', exact: true }).click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await page.locator('.expense-edit-button').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Удалить трату', exact: true })
    .click();
  await expect(page.locator('.month-switch span')).toHaveText('октябрь 2026');
  await expect(previous).toBeDisabled();
  await nav('Потрачено').click();
  await expect(previous).toBeDisabled();
  await page
    .getByRole('group', { name: 'Период статистики' })
    .getByRole('button', { name: 'Год', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Предыдущий год', exact: true })).toBeDisabled();
});

test('an account without expenses cannot browse earlier periods', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('vmeste.demo.v1', JSON.stringify({ categories: [], expenses: [] })),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  for (const name of ['История', 'Потрачено']) {
    await page
      .getByRole('navigation', { name: 'Мобильная навигация' })
      .getByRole('button', { name, exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Предыдущий месяц', exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Следующий месяц', exact: true })).toHaveCount(0);
  }
});
