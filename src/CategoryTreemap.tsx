import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { money, type Category } from './lib/model';
import { layoutTreemap } from './lib/treemap';

type Group = Category & { total: number };
export default function CategoryTreemap({ groups }: { groups: Group[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  useLayoutEffect(() => {
    const element = ref.current!;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0)
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const tiles = layoutTreemap(groups, size.width, size.height);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return (
    <div className="treemap-wrap">
      <div
        ref={ref}
        className="category-treemap"
        role="group"
        aria-label="Размер блоков показывает доли трат по категориям"
      >
        {tiles.map(({ item, x, y, width, height }) => {
          const percentage =
            ((item.total / total) * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) +
            '%';
          const label = `${item.name}: ${money(item.total)} · ${percentage}`;
          return (
            <div
              key={item.id}
              role="img"
              className={`treemap-tile ${width < 90 || height < 45 ? 'is-small' : ''} ${width < 60 ? 'is-unlabeled' : ''}`}
              style={
                {
                  '--tile-color': item.color,
                  '--tile-gap': `${Math.min(3, width / 8, height / 8)}px`,
                  left: `${(x / size.width) * 100}%`,
                  top: `${(y / size.height) * 100}%`,
                  width: `${(width / size.width) * 100}%`,
                  height: `${(height / size.height) * 100}%`,
                } as CSSProperties
              }
              aria-label={label}
            >
              <span>{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
