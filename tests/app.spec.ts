import { expect, test, type Page } from '@playwright/test';

async function enterAmount(page: Page, amount: string) {
  const keypad = page.getByRole('group', { name: 'Цифровая клавиатура' });
  for (const digit of amount)
    await keypad
      .getByRole('button', {
        name: digit,
        exact: true,
      })
      .click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Алексей'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
});

test('complete mobile flow: create, edit category, summary, export and delete', async ({
  page,
}) => {
  await enterAmount(page, '1234');
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.getByText('Расход сохранен', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  const newRow = page.locator('.expense-row').filter({ hasText: 'Алексей' });
  await expect(newRow).toContainText('1,234 ₽');
  await newRow.getByRole('button', { name: 'Редактировать Продукты' }).click();
  await expect(page.getByRole('dialog').getByLabel('Комментарий')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('textbox', { name: 'Сумма расхода' }).fill('1500');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('1,500 ₽', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Категории' })
    .click();
  await page.getByRole('button', { name: 'Редактировать категорию Продукты', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Еда');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Сводка' })
    .click();
  await expect(page.getByRole('list', { name: /Распределение/ })).toBeVisible();
  await expect(page.locator('.category-bars').getByText('Еда', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Расход', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Еда', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Экспорт расходов в CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^family-expenses-.*\.csv$/);
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream!) contents += chunk.toString();
  expect(contents).not.toContain('Комментарий');
  expect(contents).toContain('"Автор"');
  expect(contents).toContain('"Алексей"');
  expect(contents).toContain('"1500.00";"Еда"');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await newRow.getByRole('button', { name: 'Удалить Еда', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(newRow).toHaveCount(0);
});

test('validation, persistence, month navigation and mobile layout', async ({ page }) => {
  await enterAmount(page, '0');
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить расход', exact: true })).toBeDisabled();
  await enterAmount(page, '2029');
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.getByText('Расход сохранен', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('0');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Расход', exact: true })
    .waitFor();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  await expect(page.locator('.expense-row').filter({ hasText: 'Алексей' })).toContainText(
    '2,029 ₽',
  );
  expect(await page.evaluate(() => localStorage.getItem('vmeste.device'))).toBe('Алексей');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Сводка' })
    .click();
  await expect(page.getByRole('button', { name: 'Следующий месяц' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await expect(page.getByRole('heading', { name: 'Здесь пока тихо' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await navigation.getByRole('button', { name: 'История', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Следующий месяц' })).toHaveCount(0);
  await expect(page.locator('.expense-row').filter({ hasText: 'Алексей' })).toContainText(
    '2,029 ₽',
  );
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await navigation.getByRole('button', { name: 'Сводка', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Следующий месяц' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: /Распределение/ })).toBeVisible();
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await page.getByRole('button', { name: 'Следующий месяц' }).click();
  await expect(page.getByRole('button', { name: 'Следующий месяц' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: /Распределение/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/summary-mobile.png', fullPage: true });
});

test('custom categories can be created and edited', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Категории' })
    .click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Путешествия');
  await expect(page.locator('.icon-picker button')).toHaveCount(14);
  for (const name of [
    'Супермаркет',
    'Кафе',
    'Для дома',
    'Кот',
    'Тачка',
    'Одежда',
    'Здоровье',
    'Подарки',
    'Развлечения',
    'Другое',
  ]) {
    await expect(page.getByRole('button', { name: `Значок ${name}`, exact: true })).toBeVisible();
  }
  await expect(page.locator('.swatch-list button')).toHaveCount(35);
  await page.getByRole('button', { name: 'Значок Путешествия', exact: true }).click();
  await page.getByRole('button', { name: 'Цвет #3989d4', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Редактировать категорию Путешествия', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Редактировать категорию Путешествия', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Значок Путешествия', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Цвет #3989d4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Убрать категорию в архив')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Расход', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Путешествия', exact: true })).toBeVisible();
});

test('entry fits small phones and uses only the custom keypad', async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    for (let i = 9; i <= 10; i++)
      data.categories.push({
        ...data.categories[0],
        id: crypto.randomUUID(),
        name: `Категория ${i}`,
      });
    localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [400, 844],
    [401, 844],
    [430, 932],
    [430, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.quick-entry input, .quick-entry textarea')).toHaveCount(0);
    await expect(page.locator('.quick-category-grid button')).toHaveCount(10);
    const columns = await page
      .locator('.quick-category-grid')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
    await expect(page.getByRole('button', { name: 'Следующие категории' })).toHaveCount(0);
    const categoryBottom = await page
      .locator('.quick-category-grid')
      .evaluate((grid) => grid.getBoundingClientRect().bottom);
    const keypadTop = await page
      .locator('.expense-keypad')
      .evaluate((keypad) => keypad.getBoundingClientRect().top);
    expect(categoryBottom).toBeLessThanOrEqual(keypadTop);
    await expect(page.getByLabel('Дата расхода')).toHaveCount(0);
    await expect(page.getByLabel('Комментарий')).toHaveCount(0);
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      keypadBottom: document.querySelector('.expense-keypad')!.getBoundingClientRect().bottom,
      navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
    }));
    expect(bounds.width).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.height).toBeLessThanOrEqual(bounds.viewportHeight);
    expect(bounds.keypadBottom).toBeLessThanOrEqual(bounds.navTop);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Десятичная точка' })).toHaveCount(0);
  await expect(page.locator('.quick-amount-row button')).toHaveCount(0);
  await expect(
    page
      .getByRole('group', { name: 'Цифровая клавиатура' })
      .getByRole('button', { name: 'Удалить цифру' }),
  ).toBeDisabled();
  await enterAmount(page, '2840');
  await page.getByRole('button', { name: 'Продукты', exact: true }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('2,840');
  await page.screenshot({ path: 'test-results/mobile-entry.png' });
  await page.getByRole('button', { name: 'Удалить цифру' }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('284');
});

test('extra categories are paged without scrolling, and new expenses get today and no note', async ({
  page,
}) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    for (let i = 0; i < 12; i++)
      data.categories.push({
        ...data.categories[0],
        id: crypto.randomUUID(),
        name: `Своя категория ${i + 1}`,
      });
    localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await expect(page.locator('.quick-category-grid button')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Своя категория 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Следующие категории' }).click();
  await expect(page.locator('.quick-category-grid button')).toHaveCount(10);
  await page.getByRole('button', { name: 'Своя категория 3', exact: true }).click();
  await enterAmount(page, '123');
  await page.getByRole('button', { name: 'Удалить цифру' }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('12');
  const previousCount = await page.evaluate(
    () => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses.length,
  );
  await page.getByRole('button', { name: 'Сохранить расход' }).dblclick();
  await expect(page.getByText('Расход сохранен', { exact: true })).toBeVisible();
  const result = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { count: data.expenses.length, expense: data.expenses[0], today };
  });
  expect(result.count).toBe(previousCount + 1);
  expect(result.expense.amount_kopecks).toBe(1200);
  expect(result.expense.note).toBe('');
  expect(result.expense.spent_on).toBe(result.today);
  expect(result.expense.device_name).toBe('Алексей');
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('0');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
});

test('history and summary keep the mobile interface compact', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await navigation.getByRole('button', { name: 'История' }).click();
  await expect(page.locator('.page-heading')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Экспорт CSV', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Расходы за месяц' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Предыдущий месяц' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Сводка' }).click();
  await expect(page.locator('.page-heading')).toHaveCount(0);
  await expect(page.locator('.compact-summary .stat:visible')).toHaveCount(4);
  const order = await page.evaluate(() => ({
    chartBottom: document.querySelector('.summary-panel')!.getBoundingClientRect().bottom,
    statsTop: document.querySelector('.stats-grid')!.getBoundingClientRect().top,
  }));
  expect(order.chartBottom).toBeLessThan(order.statsTop);
  await page.screenshot({ path: 'test-results/summary-compact.png', fullPage: true });
});

test('first category is selected automatically and used when saving', async ({ page }) => {
  const firstCategory = page.locator('.quick-category-grid button').first();
  await expect(firstCategory).toHaveAttribute('aria-pressed', 'true');
  const firstId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).categories[0].id,
  );
  await enterAmount(page, '1');
  await expect(page.getByRole('button', { name: 'Сохранить расход', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.getByText('Расход сохранен', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('vmeste.demo.v1')!).expenses[0].category_id,
    ),
  ).toBe(firstId);
});

test('mobile toolbar height stays fixed across tabs, with titles and no tap highlight', async ({
  page,
}) => {
  const tabs = [
    ['Расход', 'Добавить расход'],
    ['История', 'История расходов'],
    ['Сводка', 'Общая картина'],
    ['Категории', 'Категории расходов'],
  ] as const;
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const measurements: number[] = [];
    for (const [tab, title] of tabs) {
      await page
        .getByRole('navigation', { name: 'Мобильная навигация' })
        .getByRole('button', { name: tab, exact: true })
        .click();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      const state = await page.evaluate(() => ({
        height: document.querySelector('.mobile-nav')!.getBoundingClientRect().height,
        highlight: getComputedStyle(document.querySelector('.mobile-nav button')!)
          .webkitTapHighlightColor,
      }));
      measurements.push(state.height);
      expect(state.highlight).toBe('rgba(0, 0, 0, 0)');
    }
    expect(new Set(measurements).size).toBe(1);
  }
});

test('success toasts expire after two seconds and repeat notifications restart their lifetime', async ({
  page,
}) => {
  await page.clock.install();
  await enterAmount(page, '1');
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.locator('.app-toast')).toContainText('Расход сохранен');
  const position = await page.evaluate(() => ({
    toastAreaBottom: document.querySelector('.expense-toast-zone')!.getBoundingClientRect().bottom,
    keypadTop: document.querySelector('.expense-keypad')!.getBoundingClientRect().top,
  }));
  expect(position.toastAreaBottom).toBeLessThan(position.keypadTop);
  await page.clock.fastForward(1500);
  await enterAmount(page, '2');
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await page.clock.fastForward(600);
  await expect(page.locator('.app-toast')).toContainText('Расход сохранен');
  await page.clock.fastForward(1500);
  await expect(page.locator('.app-toast')).toHaveCount(0);
  await enterAmount(page, '3');
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.locator('.app-toast')).toContainText('Расход сохранен');
  const navigation = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await navigation.getByRole('button', { name: 'История', exact: true }).click();
  await expect(page.locator('.app-toast')).toHaveCount(0);
  await navigation.getByRole('button', { name: 'Расход', exact: true }).click();
  await expect(page.locator('.app-toast')).toHaveCount(0);
});

test('category list actions support editing and confirmed deletion without an archive', async ({
  page,
}) => {
  const categoriesTab = page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Категории' });
  await categoriesTab.click();
  await page.getByRole('button', { name: 'Удалить категорию Продукты', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('есть расходы');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Для удаления');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await page
    .getByRole('button', { name: 'Редактировать категорию Для удаления', exact: true })
    .click();
  await expect(page.getByLabel('Убрать категорию в архив')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Удалить категорию', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить категорию Для удаления', exact: true }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Редактировать категорию Для удаления', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Удалить категорию Для удаления', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Удалить категорию Для удаления', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.app-toast[role="status"]')).toContainText('Категория удалена');
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await categoriesTab.click();
  await expect(
    page.getByRole('button', { name: 'Удалить категорию Для удаления', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Редактировать категорию Продукты', exact: true }),
  ).toBeVisible();
});

test('expense amount survives tab switches and clears after saving or leaving the account', async ({
  page,
}) => {
  await enterAmount(page, '1234');
  const nav = page.getByRole('navigation', { name: 'Мобильная навигация' });
  for (const tab of ['История', 'Сводка', 'Категории']) {
    await nav.getByRole('button', { name: tab, exact: true }).click();
    await nav.getByRole('button', { name: 'Расход', exact: true }).click();
    await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('1,234');
  }
  await page.getByRole('button', { name: 'Сохранить расход', exact: true }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('0');
  await nav.getByRole('button', { name: 'История', exact: true }).click();
  await nav.getByRole('button', { name: 'Расход', exact: true }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('0');
  await enterAmount(page, '99');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Выйти из деморежима', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть деморежим', exact: true }).click();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('0');
});
