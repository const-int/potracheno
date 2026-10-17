import { expect, test } from '@playwright/test';

test('cloud trash/restore uses owner RPCs; setup errors and failed restores keep records intact', async ({
  page,
}) => {
  const userId = '11111111-1111-4111-8111-111111111111';
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
  const date = new Date();
  const spentOn = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const original = {
    id: 'one',
    user_id: userId,
    category_id: 'food',
    amount_kopecks: 123456,
    spent_on: spentOn,
    created_at: date.toISOString(),
    device_name: 'Автор',
    note: 'Не потерять',
    deleted_at: null as string | null,
  };
  let expense = { ...original };
  let migrationMissing = true,
    failRestore = true;
  let restoreRequests = 0;
  let releaseRestore!: () => void;
  const restoreGate = new Promise<void>((r) => (releaseRestore = r));
  const methods: string[] = [];
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    methods.push(request.method());
    if (url.includes('/rpc/trash_expense')) {
      expect(request.postDataJSON()).toEqual({ expense_id: original.id });
      if (migrationMissing)
        return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Missing RPC' } });
      expense = { ...expense, deleted_at: new Date().toISOString() };
      return route.fulfill({ status: 204 });
    }
    if (url.includes('/rpc/restore_expense')) {
      expect(request.postDataJSON()).toEqual({ expense_id: original.id });
      restoreRequests++;
      if (failRestore)
        return route.fulfill({ status: 403, json: { message: 'Не удалось восстановить трату.' } });
      await restoreGate;
      expense = { ...expense, deleted_at: null };
      return route.fulfill({ status: 204 });
    }
    await route.fulfill({
      json: url.includes('/categories')
        ? [
            {
              id: 'food',
              user_id: userId,
              name: 'Продукты',
              icon: 'basket',
              color: '#589e52',
              archived: false,
            },
          ]
        : [expense],
    });
  });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await nav.getByRole('button', { name: 'История', exact: true }).click();
  await page.locator('.expense-row').getByRole('button').click();
  await page.getByRole('button', { name: 'Удалить трату', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '20261017_recently_deleted',
  );
  expect(expense).toEqual(original);
  migrationMissing = false;
  await page.getByRole('button', { name: 'Удалить трату', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.expense-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Недавно удаленные', exact: true }).click();
  const restore = page.getByRole('button', { name: 'Восстановить трату Продукты', exact: true });
  await restore.click();
  await expect(page.getByRole('alert')).toContainText('Не удалось восстановить');
  await expect(restore).toBeEnabled();
  expect(expense.deleted_at).not.toBeNull();
  failRestore = false;
  await restore.click();
  await expect(restore).toBeDisabled();
  expect(restoreRequests).toBe(2);
  releaseRestore();
  await expect(page.locator('.expense-row')).toHaveCount(0);
  await expect(page.getByText('Недавно удаленных трат нет.', { exact: true })).toBeVisible();
  expect(expense).toEqual(original);
  expect(methods).not.toContain('DELETE');
  await page.getByRole('button', { name: 'Вернуться к истории', exact: true }).click();
  await expect(page.locator('.expense-row')).toContainText('Автор · Не потерять');
  await expect(page.locator('.expense-amount')).toHaveText('1,235 ₽');
});
