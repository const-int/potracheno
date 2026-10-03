import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil } from 'lucide-react';
import type { Category, Expense } from './lib/model';

type Props = {
  categories: Category[];
  expenses: Expense[];
  renderIcon: (category: Category) => ReactNode;
  onEdit: (category: Category) => void;
  onReorder: (categories: Category[]) => Promise<void>;
};

export default function SortableCategoryList(props: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = props.categories.find((category) => category.id === activeId);
  async function finish({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id || saving) return;
    const from = props.categories.findIndex((category) => category.id === active.id);
    const to = props.categories.findIndex((category) => category.id === over.id);
    if (from < 0 || to < 0) return;
    setSaving(true);
    try {
      await props.onReorder(arrayMove(props.categories, from, to));
    } finally {
      setSaving(false);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(event) => void finish(event)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Чтобы переместить категорию, нажмите пробел, используйте стрелки и снова нажмите пробел. Escape отменяет перемещение.',
        },
        announcements: {
          onDragStart: () => 'Категория выбрана для перемещения.',
          onDragOver: ({ over }) =>
            over
              ? `Позиция ${props.categories.findIndex((category) => category.id === over.id) + 1}.`
              : undefined,
          onDragEnd: () => 'Перемещение завершено.',
          onDragCancel: () => 'Перемещение отменено.',
        },
      }}
    >
      <SortableContext
        items={props.categories.map((category) => category.id)}
        strategy={rectSortingStrategy}
      >
        <div className="category-list" aria-busy={saving}>
          {props.categories.map((category) => (
            <SortableRow key={category.id} category={category} disabled={saving} {...props} />
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay className="mobile-compact">
          {active && (
            <div className="category-manage category-drag-overlay" aria-hidden="true">
              <RowContent category={active} disabled {...props} />
              <span className="category-drag-handle">
                <GripVertical size={20} />
              </span>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

function SortableRow({
  category,
  disabled,
  ...props
}: Props & { category: Category; disabled: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`category-manage ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <RowContent category={category} disabled={disabled || isDragging} {...props} />
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="category-drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Переместить категорию ${category.name}`}
        disabled={disabled}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

function RowContent({
  category,
  disabled,
  expenses,
  renderIcon,
  onEdit,
}: Props & { category: Category; disabled: boolean }) {
  const count = expenses.filter((expense) => expense.category_id === category.id).length;
  const label = new Intl.PluralRules('ru').select(count);
  return (
    <>
      {renderIcon(category)}
      <div className="category-info">
        <strong>{category.name}</strong>
        <span>
          {count} {label === 'one' ? 'операция' : label === 'few' ? 'операции' : 'операций'}
        </span>
      </div>
      <div className="row-actions">
        <button
          className="icon-button expense-edit-button"
          aria-label={`Редактировать категорию ${category.name}`}
          disabled={disabled}
          onClick={() => onEdit(category)}
        >
          <Pencil size={20} />
        </button>
      </div>
    </>
  );
}
