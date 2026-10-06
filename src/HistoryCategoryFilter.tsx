import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import type { Category } from './lib/model';

export default function HistoryCategoryFilter({
  categories,
  selected,
  onChange,
  renderIcon,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
  renderIcon: (category: Category) => ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const viewport = window.visualViewport;
      const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
      const nav = document.querySelector<HTMLElement>('.mobile-nav');
      const bottom =
        nav && getComputedStyle(nav).display !== 'none'
          ? Math.min(viewportBottom, nav.getBoundingClientRect().top)
          : viewportBottom;
      setAvailableHeight(Math.max(96, bottom - row.current!.getBoundingClientRect().bottom - 18));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [open]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (details.current && !row.current?.contains(event.target as Node))
        details.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const label = !selected.length
    ? 'Все категории'
    : selected.length === 1
      ? categories.find((category) => category.id === selected[0])?.name
      : `Категорий: ${selected.length}`;
  return (
    <div className="history-filter-row" ref={row}>
      <details
        ref={details}
        className="history-category-filter"
        onToggle={(event) => setOpen(event.currentTarget.open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && details.current?.open) {
            event.preventDefault();
            details.current.open = false;
            details.current.querySelector('summary')?.focus();
          }
        }}
      >
        <summary role="button" aria-label="Фильтр категорий" aria-expanded={open}>
          <span>{label}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div
          className="history-filter-options"
          role="group"
          aria-label="Категории для фильтра"
          style={{ maxHeight: availableHeight }}
        >
          {categories.map((category) => (
            <label key={category.id}>
              {renderIcon(category)}
              <span>{category.name}</span>
              <span className="history-filter-check">
                <input
                  type="checkbox"
                  checked={selected.includes(category.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, category.id]
                        : selected.filter((id) => id !== category.id),
                    )
                  }
                />
                <Check size={16} aria-hidden="true" />
              </span>
            </label>
          ))}
          {!categories.length && <p className="muted">Категорий пока нет.</p>}
          <div className="history-filter-footer">
            <button
              type="button"
              className="history-filter-apply full-width"
              onClick={() => {
                if (details.current) {
                  details.current.open = false;
                  details.current.querySelector('summary')?.focus();
                }
              }}
            >
              Применить
            </button>
          </div>
        </div>
      </details>
      {selected.length > 0 && (
        <button
          type="button"
          className="history-filter-reset"
          aria-label="Сбросить фильтр"
          onClick={() => {
            onChange([]);
            details.current?.querySelector('summary')?.focus();
          }}
        >
          <X size={16} aria-hidden="true" />
          Сбросить
        </button>
      )}
    </div>
  );
}
