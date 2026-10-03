import { expect, test } from '@playwright/test';

test('mobile zoom is blocked without breaking repeated keypad taps, scroll, or Safari gesture handling', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const cancellation = await page.evaluate(() => {
    const gestureStart = new Event('gesturestart', { bubbles: true, cancelable: true });
    const gestureChange = new Event('gesturechange', { bubbles: true, cancelable: true });
    document.dispatchEvent(gestureStart);
    document.dispatchEvent(gestureChange);
    const touch = new Touch({ identifier: 1, target: document.body, clientX: 80, clientY: 200 });
    const singleTouch = new TouchEvent('touchmove', {
      touches: [touch],
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(singleTouch);
    return {
      start: gestureStart.defaultPrevented,
      change: gestureChange.defaultPrevented,
      single: singleTouch.defaultPrevented,
    };
  });
  expect(cancellation).toEqual({ start: true, change: true, single: false });
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  const keypad = page.locator('.expense-keypad');
  await keypad.getByRole('button', { name: '1', exact: true }).tap();
  await keypad.getByRole('button', { name: '0', exact: true }).tap();
  await keypad.getByRole('button', { name: '0', exact: true }).tap();
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('100');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 130, y: 230 },
      { x: 220, y: 230 },
    ],
  });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 130 - step * 8, y: 230 },
        { x: 220 + step * 8, y: 230 },
      ],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    for (let i = 0; i < 40; i++)
      data.expenses.push({ ...data.expenses[0], id: crypto.randomUUID() });
    localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'История' })
    .click();
  const previous = await page.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 140, y: 500 }],
  });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 140, y: 500 - step * 25 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(previous);
});
