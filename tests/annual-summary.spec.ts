import { expect, test } from '@playwright/test';

test('yearly summary totals, monthly highlights, navigation and compact period toggle', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00+02:00'));
  await page.addInitScript(() => {
    const category = {
      id: 'food',
      user_id: 'demo',
      name: 'Продукты',
      icon: 'basket',
      color: '#589e52',
      archived: false,
    };
    const entries = [
      ['2026-01-01', 10000],
      ['2026-06-01', 40000],
      ['2026-06-02', 20000],
      ['2026-10-01', 30000],
      ['2025-12-01', 120000],
    ] as const;
    localStorage.setItem(
      'vmeste.demo.v1',
      JSON.stringify({
        categories: [category],
        expenses: entries.map(([spent_on, amount_kopecks], i) => ({
          id: String(i),
          user_id: 'demo',
          category_id: 'food',
          spent_on,
          amount_kopecks,
          device_name: 'Тест',
          note: '',
          created_at: '2026-10-04T10:00:00Z',
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
  await nav('Потрачено').click();
  const toggle = page.getByRole('group', { name: 'Период статистики' });
  await expect(toggle.getByRole('button', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.summary-total strong')).toHaveText('300 ₽');
  await expect(
    page.getByRole('region', { name: 'Самый затратный месяц', exact: true }),
  ).toHaveCount(0);
  await toggle.getByRole('button', { name: 'Год', exact: true }).click();
  await expect(toggle.getByRole('button', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('.summary-total strong')).toHaveText('1,000 ₽');
  const costliest = page.getByRole('region', { name: 'Самый затратный месяц', exact: true });
  const average = page.getByRole('region', { name: 'Средняя месячная трата', exact: true });
  await expect(costliest.locator('strong')).toHaveText('600 ₽');
  await expect(costliest.locator('small')).toHaveText('июнь');
  await expect(average.locator('strong')).toHaveText('100 ₽');
  await expect(page.locator('.compact-summary .stat:visible')).toHaveCount(6);
  await expect(
    page.getByRole('region', { name: 'Самая крупная трата', exact: true }).locator('strong'),
  ).toHaveText('400 ₽');
  await expect(page.getByRole('button', { name: 'Следующий год', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Предыдущий год', exact: true }).click();
  await expect(page.locator('.summary-total strong')).toHaveText('1,200 ₽');
  await expect(average.locator('strong')).toHaveText('100 ₽');
  await expect(average.locator('small')).toHaveText('За 12 месяцев');
  await page.getByRole('button', { name: 'Следующий год', exact: true }).click();
  await expect(page.locator('.summary-total strong')).toHaveText('1,000 ₽');
  await toggle.getByRole('button', { name: 'Месяц', exact: true }).click();
  await expect(page.locator('.summary-total strong')).toHaveText('300 ₽');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const row = await page.locator('.summary-period-row').evaluate((el) => ({
      fontSize: getComputedStyle(el.querySelector('.month-switch')!).fontSize,
      buttonWidth: el.querySelector('.month-switch button')!.getBoundingClientRect().width,
      right:
        el.getBoundingClientRect().right -
        el.querySelector('.period-toggle')!.getBoundingClientRect().right,
    }));
    expect(row.fontSize).toBe('16px');
    expect(row.buttonWidth).toBe(33);
    expect(Math.abs(row.right)).toBeLessThanOrEqual(1);
  }
  await toggle.getByRole('button', { name: 'Год', exact: true }).click();
  await nav('История').click();
  await expect(toggle).toHaveCount(0);
  await nav('Потрачено').click();
  await expect(toggle.getByRole('button', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await toggle.getByRole('button', { name: 'Год', exact: true }).click();
  await page.getByRole('button', { name: 'Предыдущий год', exact: true }).click();
  await page.getByRole('button', { name: 'Предыдущий год', exact: true }).click();
  await expect(page.getByText('В этом году еще нет трат.', { exact: true })).toBeVisible();
  await expect(average.locator('strong')).toHaveText('0 ₽');
  await expect(costliest.locator('strong')).toHaveText('—');
});
