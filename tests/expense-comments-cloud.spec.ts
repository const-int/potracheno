import { expect, test } from '@playwright/test';

test('cloud comment failures keep draft and pause; retry updates only the saved expense note', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const category = {
    id: 'food',
    user_id: userId,
    name: 'Продукты',
    icon: 'basket',
    color: '#589e52',
    archived: false,
  };
  let expense: Record<string, unknown> | null = null;
  const patches: Record<string, unknown>[] = [];
  let fail = true;
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: expiry }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  await page.addInitScript(
    ({ token, expiry, userId }) => {
      localStorage.setItem('vmeste.device', 'Автор');
      localStorage.setItem(
        'sb-potracheno-test-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test-refresh',
          token_type: 'bearer',
          expires_at: expiry,
          user: {
            id: userId,
            email: 'family@example.invalid',
            aud: 'authenticated',
            role: 'authenticated',
          },
        }),
      );
    },
    { token, expiry, userId },
  );
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().url().includes('/categories')) return route.fulfill({ json: [category] });
    if (route.request().method() === 'POST') {
      expense = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: [] });
    }
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON();
      patches.push(patch);
      if (fail) return route.fulfill({ status: 403, json: { message: 'Test failure' } });
      expense = { ...expense, ...patch };
      return route.fulfill({ json: expense });
    }
    return route.fulfill({ json: expense ? [expense] : [] });
  });
  await page.goto('/');
  await page
    .getByRole('group', { name: 'Цифровая клавиатура' })
    .getByRole('button', { name: '8', exact: true })
    .click();
  await page.getByRole('button', { name: 'Сохранить трату', exact: true }).click();
  await page.getByRole('button', { name: 'Комментарий', exact: true }).click();
  await page.getByLabel('Комментарий', { exact: true }).fill('Комментарий из облака');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.getByLabel('Комментарий', { exact: true })).toHaveValue(
    'Комментарий из облака',
  );
  expect(patches[0]).toEqual({ note: 'Комментарий из облака' });
  fail = false;
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.locator('.app-toast-comment-saved')).toBeVisible();
  expect(patches[1]).toEqual({ note: 'Комментарий из облака' });
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История', exact: true })
    .click();
  await expect(page.locator('.expense-row')).toContainText('Автор · Комментарий из облака');
  await page.locator('.expense-row').getByRole('button').click();
  await page.getByLabel('Комментарий', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(expense).toMatchObject({ note: '', amount_kopecks: 800, device_name: 'Автор' });
});
