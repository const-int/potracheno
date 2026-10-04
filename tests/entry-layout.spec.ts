import { expect, test } from '@playwright/test';

test('categories stay immediately above the keypad and the amount fills the upper space as Chrome viewport height changes', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  for (const count of [3, 8, 10, 13]) {
    await page.evaluate((count) => {
      const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
      const example = data.categories[0];
      data.categories = Array.from({ length: count }, (_, index) => ({
        ...example,
        id: String(index),
        name: `Категория ${index + 1}`,
        sort_order: index,
      }));
      data.expenses = [];
      localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
    }, count);
    await page.reload();
    await page.getByRole('button', { name: 'Открыть деморежим' }).click();
    await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
    for (const [width, height] of [
      [320, 480],
      [360, 520],
      [320, 568],
      [375, 667],
      [412, 823],
      [430, 932],
    ]) {
      await page.setViewportSize({ width, height });
      await expect
        .poll(() =>
          page.locator('.mobile-entry').evaluate((el) => el.getBoundingClientRect().height),
        )
        .toBe(height);
      const geometry = await page.evaluate(() => {
        const entry = document.querySelector('.quick-entry')!;
        const categories = document.querySelector('.quick-categories')!.getBoundingClientRect();
        const lastCategory = [...document.querySelectorAll('.quick-category')]
          .at(-1)!
          .getBoundingClientRect();
        const keypad = document.querySelector('.expense-keypad')!.getBoundingClientRect();
        const header = document.querySelector('.topbar')!.getBoundingClientRect();
        const amount = document.querySelector('.quick-amount')!.getBoundingClientRect();
        const pager = document.querySelector('.quick-category-pages')?.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(entry).rowGap);
        return {
          keypadGap: keypad.top - categories.bottom,
          expectedGap: gap,
          emptySpaceBelowLast: lastCategory.bottom - (pager?.top ?? categories.bottom),
          amountCenter: amount.top + amount.height / 2,
          expectedCenter: (header.bottom + categories.top - gap) / 2,
          keypadBottom: keypad.bottom,
          navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
          scrollHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          rows: getComputedStyle(
            document.querySelector('.quick-category-grid')!,
          ).gridTemplateRows.split(' ').length,
        };
      });
      expect(geometry.keypadGap).toBeCloseTo(geometry.expectedGap, 1);
      expect(Math.abs(geometry.emptySpaceBelowLast)).toBeLessThan(1);
      expect(Math.abs(geometry.amountCenter - geometry.expectedCenter)).toBeLessThan(1);
      expect(geometry.keypadBottom).toBeLessThanOrEqual(geometry.navTop);
      expect(geometry.scrollHeight).toBeLessThanOrEqual(height);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
      expect(geometry.rows).toBe(Math.ceil(Math.min(count, 10) / 2));
    }
    if (count > 10) {
      await page.getByRole('button', { name: 'Следующие категории' }).click();
      await expect(page.locator('.quick-category')).toHaveCount(3);
      const gap = await page.evaluate(
        () =>
          document.querySelector('.quick-category-pages')!.getBoundingClientRect().top -
          [...document.querySelectorAll('.quick-category')].at(-1)!.getBoundingClientRect().bottom,
      );
      expect(Math.abs(gap)).toBeLessThan(1);
    }
  }
});
