import { expect, test } from '@playwright/test';

test('production PWA passes Chrome checks under the repository subpath and caches only its shell', async ({
  page,
  context,
}) => {
  await page.goto('/potracheno/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: 'networkidle' });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe('http://127.0.0.1:4175/potracheno/');
  const cdp = await context.newCDPSession(page);
  const result = await cdp.send('Page.getAppManifest');
  expect(result.errors).toEqual([]);
  const manifest = JSON.parse(result.data!);
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('potracheno');
  expect(new URL(manifest.start_url, result.url).pathname).toBe('/potracheno/');
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, result.url).href);
    expect(response.status()).toBe(200);
    const png = await response.body();
    const [width, height] = icon.sizes.split('x').map(Number);
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);
  }
  expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  const cacheUrls = await page.evaluate(async () => {
    const requests = await Promise.all(
      (await caches.keys()).map(async (key) => (await caches.open(key)).keys()),
    );
    return requests.flat().map((request) => request.url);
  });
  expect(cacheUrls.length).toBeGreaterThan(0);
  expect(cacheUrls.every((url) => url.startsWith('http://127.0.0.1:4175/potracheno/'))).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Открыть деморежим' }).click();
  await expect(page.getByRole('group', { name: 'Цифровая клавиатура' })).toBeVisible();
});
