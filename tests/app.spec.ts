import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByRole('heading', { name: 'Новый расход' }).waitFor();
  await page.getByRole('button', { name: 'Назвать устройство' }).click();
  await page.getByLabel('Название устройства', { exact: true }).fill('Тестовый телефон');
  await page.getByRole('button', { name: 'Сохранить название' }).click();
});

test('complete mobile flow: create, edit, archive category, summary, export and delete', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Сумма расхода' }).fill('1234,56');
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await page.getByLabel('Комментарий').fill('Тестовая покупка');
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Расход сохранен');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  await expect(page.getByText('Тестовая покупка', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать Тестовая покупка' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Сумма расхода' }).fill('1500,01');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('1 500,01 ₽', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Категории' })
    .click();
  await page.getByRole('button', { name: /^Продукты/ }).click();
  await page.getByLabel('Название', { exact: true }).fill('Еда');
  await page.getByLabel('Убрать категорию в архив').check();
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Summary' })
    .click();
  await expect(page.getByRole('img', { name: /Распределение/ })).toBeVisible();
  await expect(page.locator('.legend').getByText('Еда', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Расход', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Еда', exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^family-expenses-.*\.csv$/);
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream!) contents += chunk.toString();
  expect(contents).toContain('Тестовая покупка');
  expect(contents).toContain('"1500,01";"Еда"');
  await page.getByRole('button', { name: 'Удалить Тестовая покупка', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByText('Тестовая покупка', { exact: true })).toHaveCount(0);
});

test('validation, persistence, month navigation and mobile layout', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Сумма расхода' }).fill('0');
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Укажите сумму больше нуля');
  await page.getByRole('textbox', { name: 'Сумма расхода' }).fill('20,29');
  await page.getByLabel('Комментарий').fill('Запись для перезагрузки');
  await page.getByRole('button', { name: 'Добавить расход', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Расход сохранен');
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await expect(page.getByText('Запись для перезагрузки', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Тестовый телефон' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Summary' })
    .click();
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await expect(page.getByRole('heading', { name: 'Здесь пока тихо' })).toBeVisible();
  await page.getByRole('button', { name: 'Следующий месяц' }).click();
  await expect(page.getByRole('img', { name: /Распределение/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/summary-mobile.png', fullPage: true });
});

test('custom categories can be created and restored from archive', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Категории' })
    .click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Путешествия');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Путешествия/ })).toBeVisible();
  await page.getByRole('button', { name: /^Путешествия/ }).click();
  await page.getByLabel('Убрать категорию в архив').check();
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Путешествия/ }).click();
  await page.getByLabel('Убрать категорию в архив').uncheck();
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Расход', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Путешествия', exact: true })).toBeVisible();
});
