import { expect, test, type Page } from '@playwright/test';

async function sampleMotion(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ x: number; y: number; time: number }[]>((resolve) => {
        const points: { x: number; y: number; time: number }[] = [];
        const start = performance.now();
        const sample = () => {
          const toast = document.querySelector('.app-toast');
          if (!toast) return resolve(points);
          const box = toast.getBoundingClientRect();
          points.push({ x: box.x, y: box.y, time: performance.now() - start });
          if (performance.now() - start < 350) requestAnimationFrame(sample);
          else resolve(points);
        };
        requestAnimationFrame(sample);
      }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vmeste.device', 'Тест'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page
    .getByRole('group', { name: 'Цифровая клавиатура' })
    .getByRole('button', { name: '8', exact: true })
    .click();
  await page.getByRole('button', { name: 'Сохранить трату', exact: true }).click();
  await page
    .locator('.app-toast')
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
});

for (const end of ['touchEnd', 'touchCancel'] as const) {
  test(`short touch swipe returns smoothly without replaying entry (${end})`, async ({ page }) => {
    const toast = page.locator('.app-toast');
    const original = (await toast.boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const point = { x: original.x + 90, y: original.y + original.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, x: point.x + 35 }],
    });
    await expect.poll(async () => (await toast.boundingBox())!.x).toBeCloseTo(original.x + 35, 0);
    const motion = sampleMotion(page);
    await session.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
    const samples = await motion;
    // A genuine return contains intermediate positions, with no vertical entrance replay.
    expect(samples.some((p) => p.x > original.x + 2 && p.x < original.x + 30)).toBe(true);
    expect(samples.every((p) => Math.abs(p.y - original.y) < 1)).toBe(true);
    expect(samples.at(-1)!.x).toBeCloseTo(original.x, 0);
    for (let i = 1; i < samples.length; i++)
      expect(samples[i].x).toBeLessThanOrEqual(samples[i - 1].x + 1);
    await expect(toast).toBeVisible();
    await expect(page.getByRole('button', { name: 'Комментарий', exact: true })).toBeEnabled();
  });
}

test('full touch swipe continues outward rather than snapping back before dismissal', async ({
  page,
}) => {
  const toast = page.locator('.app-toast');
  const original = (await toast.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const point = { x: original.x + 90, y: original.y + original.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...point, x: point.x + 100 }],
  });
  await expect.poll(async () => (await toast.boundingBox())!.x).toBeCloseTo(original.x + 100, 0);
  const motion = sampleMotion(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const samples = await motion;
  expect(samples.every((p) => p.x >= original.x + 99 && Math.abs(p.y - original.y) < 1)).toBe(true);
  expect(samples.some((p) => p.x > original.x + 150)).toBe(true);
  await expect(toast).toHaveCount(0);
});
