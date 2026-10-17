import { expect, test, type Page } from '@playwright/test';
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name, exact: true });
async function expectNeutralFocus(page: Page, title: string) {
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: title, exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: title, exact: true }),
  ).toHaveCSS('outline-style', 'none');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }),
  ).not.toBeFocused();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Тест'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
});

test('dialogs start with neutral heading focus and keep the close button keyboard accessible', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expectNeutralFocus(page, 'Настройки');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Импорт трат из CSV', exact: true }).click();
  await expectNeutralFocus(page, 'Импорт трат');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await nav(page, 'Категории').click();
  await page.getByRole('button', { name: 'Редактировать категорию Продукты', exact: true }).click();
  await expectNeutralFocus(page, 'Изменить категорию');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await nav(page, 'История').click();
  await page.locator('.expense-row').first().getByRole('button').click();
  await expectNeutralFocus(page, 'Редактировать трату');
});

test('expense date stays inside the dialog at the same height as other fields on phone widths', async ({
  page,
}) => {
  await nav(page, 'История').click();
  await page.locator('.expense-row').first().getByRole('button').click();
  for (const size of [
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    const geometry = await page.getByRole('dialog').evaluate((modal) => {
      const field = modal.querySelector('input[type="date"]')!,
        comment = modal.querySelector('.expense-comment-input')!;
      const outer = modal.getBoundingClientRect(),
        date = field.getBoundingClientRect(),
        other = comment.getBoundingClientRect();
      return {
        left: date.left - outer.left,
        right: outer.right - date.right,
        height: date.height,
        commentHeight: other.height,
        width: date.width,
        commentWidth: other.width,
        overflow: modal.scrollWidth > modal.clientWidth,
        appearance: getComputedStyle(field).getPropertyValue('appearance'),
      };
    });
    expect(geometry.height).toBeCloseTo(44, 1);
    expect(geometry.height).toBeCloseTo(geometry.commentHeight, 1);
    expect(geometry.width).toBeCloseTo(geometry.commentWidth, 1);
    expect(geometry.left).toBeGreaterThan(12);
    expect(geometry.right).toBeGreaterThan(12);
    expect(geometry.overflow).toBe(false);
    expect(geometry.appearance).toBe('none');
  }
  await page.getByLabel('Дата траты', { exact: true }).fill('2026-09-05');
  await expect(page.locator('.expense-date-display')).toHaveText('5 сентября 2026');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.some(
        (e: { spent_on: string }) => e.spent_on === '2026-09-05',
      ),
    ),
  ).toBe(true);
});

test('comment dialog follows the visible viewport above an iPhone-style keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: 932, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'testCommentViewport', { configurable: true, value: viewport });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('group', { name: 'Цифровая клавиатура' })
    .getByRole('button', { name: '8', exact: true })
    .click();
  await page.getByRole('button', { name: 'Сохранить трату', exact: true }).click();
  await page.getByRole('button', { name: 'Комментарий', exact: true }).click();
  const dialog = page.locator('.comment-modal');
  await expect(page.getByLabel('Комментарий', { exact: true })).toBeFocused();
  for (const viewport of [
    { height: 510, top: 0 },
    { height: 420, top: 48 },
    { height: 310, top: 24 },
    { height: 932, top: 0 },
  ]) {
    await page.evaluate(({ height, top }) => {
      const viewport = (
        window as unknown as {
          testCommentViewport: EventTarget & { height: number; offsetTop: number };
        }
      ).testCommentViewport;
      viewport.height = height;
      viewport.offsetTop = top;
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
    }, viewport);
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.style.getPropertyValue('--app-viewport-height'),
        ),
      )
      .toBe(`${viewport.height}px`);
    const geometry = await dialog.evaluate((element) => {
      const dialog = element.getBoundingClientRect();
      const buttons = element.querySelector('.category-form-actions')!.getBoundingClientRect();
      const input = element.querySelector('input')!.getBoundingClientRect();
      return {
        top: dialog.top,
        bottom: dialog.bottom,
        center: (dialog.top + dialog.bottom) / 2,
        buttonBottom: buttons.bottom,
        buttonTop: buttons.top,
        inputBottom: input.bottom,
        inputTop: input.top,
        layoutHeight: innerHeight,
      };
    });
    expect(geometry.layoutHeight).toBe(932);
    expect(geometry.top).toBeGreaterThanOrEqual(viewport.top + 11);
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.top + viewport.height - 11);
    expect(geometry.buttonBottom).toBeLessThan(geometry.bottom);
    expect(geometry.buttonTop).toBeGreaterThanOrEqual(geometry.inputBottom);
    expect(geometry.inputTop).toBeGreaterThan(geometry.top);
    expect(geometry.center).toBeCloseTo(viewport.top + viewport.height / 2, 0);
    await expect(page.getByLabel('Комментарий', { exact: true })).toBeFocused();
  }
  await page.getByLabel('Комментарий', { exact: true }).fill('Над клавиатурой');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.app-toast-comment-saved')).toBeVisible();
});
