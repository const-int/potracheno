import { expect, test } from '@playwright/test';

test('static treemap areas match category shares at mobile sizes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Сводка' })
    .click();
  await expect(page.locator('.treemap-tile')).toHaveCount(7);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const chart = document.querySelector('.category-treemap')!.getBoundingClientRect();
          const shares = new Map(
            [...document.querySelectorAll('.category-bar-item')].map((row) => [
              row.querySelector('.category-bar-name')!.textContent,
              Number(row.querySelector('[role="meter"]')!.getAttribute('aria-valuenow')),
            ]),
          );
          return [...document.querySelectorAll('.treemap-tile')].every((tile) => {
            const rect = tile.getBoundingClientRect();
            const name = tile.querySelector('span')!.textContent;
            return (
              Math.abs(
                ((rect.width * rect.height) / (chart.width * chart.height)) * 100 -
                  shares.get(name)!,
              ) < 0.05
            );
          });
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await expect(page.locator('.category-treemap').getByRole('button')).toHaveCount(0);
  const first = page.locator('.treemap-tile').first();
  await expect(first).toHaveAttribute('role', 'img');
  await expect(first).toHaveAttribute('aria-label', /₽.*%/);
  await first.tap();
  await expect(page.locator('.treemap-detail')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/summary-treemap.png', fullPage: true });
});
