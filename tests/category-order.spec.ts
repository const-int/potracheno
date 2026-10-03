import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name, exact: true });
const names = (page: Page) => page.locator('.category-list .category-info strong');

async function moveWithKeyboard(page: Page, name: string, direction: 'ArrowDown' | 'ArrowUp') {
  const handle = page.getByRole('button', { name: `Переместить категорию ${name}`, exact: true });
  await handle.focus();
  const index = (await names(page).allTextContents()).indexOf(name);
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[id^="DndLiveRegion-"]')).toContainText(`Позиция ${index + 1}.`);
  await page.keyboard.press(direction);
  await expect(page.locator('[id^="DndLiveRegion-"]')).toContainText(
    `Позиция ${index + (direction === 'ArrowDown' ? 2 : 0)}.`,
  );
  await page.keyboard.press('Space');
}

test('touch reordering persists, matches the expense picker, and survives edits and new categories', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await nav(page, 'Категории').click();
  const original = await names(page).allTextContents();
  const handle = await page
    .getByRole('button', { name: `Переместить категорию ${original[0]}`, exact: true })
    .boundingBox();
  const target = await page.locator('.category-list .category-manage').nth(2).boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = handle!.x + handle!.width / 2;
  const fromY = handle!.y + handle!.height / 2;
  const toY = target!.y + target!.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: fromY }],
  });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: fromY + ((toY - fromY) * step) / 8 }],
    });
    await page.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const reordered = [original[1], original[2], original[0], ...original.slice(3)];
  await expect(names(page)).toHaveText(reordered);
  await expect(page.locator('.app-toast[role="status"]')).toContainText(
    'Порядок категорий сохранён',
  );
  await nav(page, 'Расход').click();
  await expect(page.locator('.quick-category-name')).toHaveText(reordered);
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await expect(page.locator('.quick-category-name')).toHaveText(reordered);
  await nav(page, 'Категории').click();
  await page
    .getByRole('button', { name: `Редактировать категорию ${original[1]}`, exact: true })
    .click();
  await page.getByLabel('Название', { exact: true }).fill('Первая');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  reordered[0] = 'Первая';
  await expect(names(page)).toHaveText(reordered);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Новая');
  await page.getByRole('button', { name: 'Сохранить категорию' }).click();
  await expect(names(page)).toHaveText([...reordered, 'Новая']);
});

test('cloud order is saved in one RPC, survives reload, and rolls back after an error', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const categories = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'А' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Б' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'В' },
  ].map((category, index) => ({
    ...category,
    user_id: userId,
    icon: 'other',
    color: '#806697',
    archived: false,
    sort_order: index,
  }));
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  await page.route('**/auth/v1/token?grant_type=password', (route) =>
    route.fulfill({
      json: {
        access_token: token,
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expiresAt,
        user: {
          id: userId,
          email: 'family@example.invalid',
          aud: 'authenticated',
          role: 'authenticated',
        },
      },
    }),
  );
  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({
      json: {
        id: userId,
        email: 'family@example.invalid',
        aud: 'authenticated',
        role: 'authenticated',
      },
    }),
  );
  let calls = 0;
  let fail = false;
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/rpc/reorder_categories')) {
      calls++;
      if (fail) {
        await route.fulfill({
          status: 400,
          json: { code: 'P0001', message: 'Не удалось сохранить порядок.' },
        });
        return;
      }
      const ids = route.request().postDataJSON().ordered_ids as string[];
      expect(ids).toHaveLength(3);
      categories.forEach((category) => {
        category.sort_order = ids.indexOf(category.id);
      });
      await route.fulfill({ status: 204, body: '' });
    } else {
      expect(route.request().method()).toBe('GET');
      await route.fulfill({ json: url.includes('/categories') ? categories : [] });
    }
  });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('family@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password');
  await page.getByLabel('Имя пользователя', { exact: true }).fill('Анна');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await nav(page, 'Категории').click();
  await expect(names(page)).toHaveText(['А', 'Б', 'В']);
  await moveWithKeyboard(page, 'А', 'ArrowDown');
  await expect(names(page)).toHaveText(['Б', 'А', 'В']);
  await expect(page.locator('.app-toast[role="status"]')).toContainText(
    'Порядок категорий сохранён',
  );
  expect(calls).toBe(1);
  await page.reload();
  await expect(page.locator('.quick-category-name')).toHaveText(['Б', 'А', 'В']);
  await nav(page, 'Категории').click();
  fail = true;
  await moveWithKeyboard(page, 'Б', 'ArrowDown');
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить порядок.');
  await expect(names(page)).toHaveText(['Б', 'А', 'В']);
  expect(calls).toBe(2);
});
