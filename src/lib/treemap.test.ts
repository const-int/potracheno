import { expect, it } from 'vitest';
import { layoutTreemap } from './treemap';

it('uses exact proportional areas, fills the chart, and never overlaps tiles', () => {
  const items = [7903344, 3600000, 2180000, 1765000, 890000, 400000, 80000].map((total, id) => ({
    id,
    total,
  }));
  const original = structuredClone(items);
  for (const [width, height] of [
    [322, 242],
    [254, 220],
    [900, 380],
  ]) {
    const tiles = layoutTreemap(items, width, height);
    const total = items.reduce((sum, item) => sum + item.total, 0);
    expect(tiles).toHaveLength(items.length);
    expect(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBeCloseTo(
      width * height,
      6,
    );
    for (const tile of tiles) {
      expect((tile.width * tile.height) / (width * height)).toBeCloseTo(
        tile.item.total / total,
        10,
      );
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(width + 1e-8);
      expect(tile.y + tile.height).toBeLessThanOrEqual(height + 1e-8);
      for (const other of tiles.filter((candidate) => candidate !== tile)) {
        const overlapWidth =
          Math.min(tile.x + tile.width, other.x + other.width) - Math.max(tile.x, other.x);
        const overlapHeight =
          Math.min(tile.y + tile.height, other.y + other.height) - Math.max(tile.y, other.y);
        expect(overlapWidth <= 1e-8 || overlapHeight <= 1e-8).toBe(true);
      }
    }
  }
  expect(items).toEqual(original);
});

it('handles a single category, empty data, and zero-sized charts', () => {
  expect(layoutTreemap([{ total: 10 }], 100, 50)).toEqual([
    { item: { total: 10 }, x: 0, y: 0, width: 100, height: 50 },
  ]);
  expect(layoutTreemap([{ total: 0 }], 100, 50)).toEqual([]);
  expect(layoutTreemap([], 100, 50)).toEqual([]);
  expect(layoutTreemap([{ total: 10 }], 0, 50)).toEqual([]);
});
