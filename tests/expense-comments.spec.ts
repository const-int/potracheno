import { expect, test, type Page } from '@playwright/test';

async function add(page: Page) {
  await page
    .getByRole('group', { name: 'Цифровая клавиатура' })
    .getByRole('button', { name: '8', exact: true })
    .click();
  await page.getByRole('button', { name: 'Сохранить трату', exact: true }).click();
  await expect(page.locator('.app-toast-amount')).toHaveText('8 ₽');
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Автор'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма траты', { exact: true }).waitFor();
});

test('comment autofocus, paused lifetime, saved checkmark, history and editing', async ({
  page,
}) => {
  await page.clock.install();
  await add(page);
  await page.clock.fastForward(800);
  await page.getByRole('button', { name: 'Комментарий', exact: true }).click();
  await expect(page.getByLabel('Комментарий', { exact: true })).toBeFocused();
  await page.clock.fastForward(10000);
  await expect(page.locator('.app-toast')).toHaveCount(1);
  await page.getByLabel('Комментарий', { exact: true }).fill('Корм для кота');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.app-toast-comment-saved')).toBeVisible();
  await page.clock.fastForward(1000);
  await expect(page.locator('.app-toast')).toHaveCount(1);
  await page.clock.fastForward(1500);
  await expect(page.locator('.app-toast')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История', exact: true })
    .click();
  const row = page.locator('.expense-row').filter({ hasText: 'Автор' });
  await expect(row).toContainText('Автор · Корм для кота');
  await row.getByRole('button').click();
  await expect(page.getByLabel('Комментарий', { exact: true })).toHaveValue('Корм для кота');
  await page.getByLabel('Комментарий', { exact: true }).fill('Другой комментарий');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(row).toContainText('Другой комментарий');
  await row.getByRole('button').click();
  await page.getByRole('button', { name: 'Очистить комментарий', exact: true }).click();
  await expect(page.getByLabel('Комментарий', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Комментарий', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Очистить комментарий', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(row).not.toContainText('Другой комментарий');
  await expect(row).toContainText('8 ₽');
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История', exact: true })
    .click();
  await expect(row).not.toContainText('Другой комментарий');
});

test('cancel resumes the remaining timer; swiping dismisses a toast', async ({ page }) => {
  await page.clock.install();
  await add(page);
  await page.clock.fastForward(1000);
  await page.getByRole('button', { name: 'Комментарий', exact: true }).click();
  await page.getByLabel('Комментарий', { exact: true }).fill('Не сохранять');
  await page.clock.fastForward(8000);
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Комментарий', exact: true })).toBeVisible();
  await page.clock.fastForward(2300);
  await expect(page.locator('.app-toast')).toHaveCount(0);
  await add(page);
  const box = (await page.locator('.app-toast').boundingBox())!;
  await page.mouse.move(box.x + 45, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.clock.fastForward(300);
  await expect(page.locator('.app-toast')).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('vmeste.demo.v1')!)
        .expenses.filter((e: { device_name: string }) => e.device_name === 'Автор')
        .every((e: { note: string }) => e.note === ''),
    ),
  ).toBe(true);
});
