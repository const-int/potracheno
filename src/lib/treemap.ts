export type TreemapTile<T> = { item: T; x: number; y: number; width: number; height: number };

// Split groups near equal weight along the longer side. Every tile retains its exact share.
export function layoutTreemap<T extends { total: number }>(
  items: T[],
  width: number,
  height: number,
): TreemapTile<T>[] {
  if (width <= 0 || height <= 0) return [];
  const values = items.filter((item) => Number.isFinite(item.total) && item.total > 0);
  const tiles: TreemapTile<T>[] = [];
  function split(group: T[], x: number, y: number, w: number, h: number) {
    if (!group.length) return;
    if (group.length === 1) {
      tiles.push({ item: group[0], x, y, width: w, height: h });
      return;
    }
    const total = group.reduce((sum, item) => sum + item.total, 0);
    let prefix = 0;
    let best = Infinity;
    let index = 1;
    let firstTotal = 0;
    for (let i = 1; i < group.length; i++) {
      prefix += group[i - 1].total;
      const difference = Math.abs(total / 2 - prefix);
      if (difference < best) {
        best = difference;
        index = i;
        firstTotal = prefix;
      }
    }
    if (w >= h) {
      const firstWidth = (w * firstTotal) / total;
      split(group.slice(0, index), x, y, firstWidth, h);
      split(group.slice(index), x + firstWidth, y, w - firstWidth, h);
    } else {
      const firstHeight = (h * firstTotal) / total;
      split(group.slice(0, index), x, y, w, firstHeight);
      split(group.slice(index), x, y + firstHeight, w, h - firstHeight);
    }
  }
  split(values, 0, 0, width, height);
  return tiles;
}
