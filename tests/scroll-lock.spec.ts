import { expect, test } from '@playwright/test';

const nav = (page: import('@playwright/test').Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name, exact: true });

test('every tab switch resets scroll, including returning to a previously scrolled tab', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 520 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    for (let i = 0; i < 40; i++)
      data.expenses.push({ ...data.expenses[0], id: crypto.randomUUID() });
    for (let i = 0; i < 12; i++)
      data.categories.push({
        ...data.categories[0],
        id: crypto.randomUUID(),
        name: `Категория ${i}`,
      });
    localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  for (const name of ['История', 'Потрачено', 'Категории', 'История', 'Категории', 'Потрачено']) {
    await nav(page, name).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect
      .poll(() => page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().top))
      .toBe(0);
    await page.evaluate(() => scrollTo(0, 200));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
  await nav(page, 'Трата').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('html')).toHaveClass(/entry-viewport-locked/);
  await nav(page, 'История').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('entry locks page scrolling on return from history while history and modals remain scrollable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vmeste.demo.v1')!);
    for (let i = 0; i < 40; i++)
      data.expenses.push({ ...data.expenses[0], id: crypto.randomUUID() });
    localStorage.setItem('vmeste.demo.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  const keypad = page.locator('.expense-keypad');
  await keypad.getByRole('button', { name: '1', exact: true }).tap();
  await keypad.getByRole('button', { name: '2', exact: true }).tap();
  await nav(page, 'История').click();
  await page.evaluate(() => scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY),
  ).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)).toBe(
    'none',
  );
  await nav(page, 'Трата').click();
  await expect(page.locator('html')).toHaveClass(/entry-viewport-locked/);
  await expect(page.getByLabel('Сумма расхода', { exact: true })).toHaveText('12');
  await page.evaluate(() => {
    scrollTo(0, 500);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  const geometry = await page.evaluate(() => ({
    headerTop: document.querySelector('.topbar')!.getBoundingClientRect().top,
    keypadBottom: document.querySelector('.expense-keypad')!.getBoundingClientRect().bottom,
    navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
    screenBottom: (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? innerHeight),
    appBottom: document.querySelector('.mobile-entry')!.getBoundingClientRect().bottom,
  }));
  expect(geometry.headerTop).toBe(0);
  expect(geometry.keypadBottom).toBeLessThanOrEqual(geometry.navTop);
  expect(geometry.appBottom).toBeLessThanOrEqual(geometry.screenBottom);
  await nav(page, 'История').click();
  await expect(page.locator('html')).not.toHaveClass(/entry-viewport-locked/);
  await page.evaluate(() => scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.locator('.expense-edit-button').first().click();
  expect(
    await page.getByRole('dialog').evaluate((el) => getComputedStyle(el).overscrollBehaviorY),
  ).toBe('none');
});

test('entry follows visible Chrome viewport changes and resume even when layout viewport stays tall', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: 512, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Object.defineProperty(window, 'testVisibleViewport', { configurable: true, value: viewport });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await page.getByLabel('Сумма расхода', { exact: true }).waitFor();
  const testViewport = async (height: number, top: number, event: string) => {
    await page.evaluate(
      ({ height, top, event }) => {
        const viewport = (
          window as unknown as {
            testVisibleViewport: EventTarget & { height: number; offsetTop: number };
          }
        ).testVisibleViewport;
        viewport.height = height;
        viewport.offsetTop = top;
        if (event === 'pageshow')
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        else if (event === 'visibilitychange')
          document.dispatchEvent(new Event('visibilitychange'));
        else viewport.dispatchEvent(new Event(event));
      },
      { height, top, event },
    );
    await expect
      .poll(() => page.locator('.mobile-entry').evaluate((el) => el.getBoundingClientRect().height))
      .toBe(height);
    const geometry = await page.evaluate(() => ({
      headerTop: document.querySelector('.topbar')!.getBoundingClientRect().top,
      navBottom: document.querySelector('.mobile-nav')!.getBoundingClientRect().bottom,
      navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top,
      keypadBottom: document.querySelector('.expense-keypad')!.getBoundingClientRect().bottom,
      gap:
        document.querySelector('.expense-keypad')!.getBoundingClientRect().top -
        document.querySelector('.quick-categories')!.getBoundingClientRect().bottom,
      layoutHeight: innerHeight,
    }));
    expect(geometry.layoutHeight).toBe(844);
    expect(geometry.headerTop).toBe(top);
    expect(geometry.navBottom).toBe(top + height);
    expect(geometry.keypadBottom).toBeLessThanOrEqual(geometry.navTop);
    expect(geometry.gap).toBeGreaterThanOrEqual(6);
    expect(geometry.gap).toBeLessThanOrEqual(12);
  };
  await testViewport(512, 0, 'resize');
  await testViewport(580, 0, 'resize');
  await testViewport(844, 0, 'pageshow');
  await testViewport(512, 16, 'visibilitychange');
});
