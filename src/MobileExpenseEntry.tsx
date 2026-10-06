import { useRef, useState, type Dispatch, type SetStateAction, type CSSProperties } from 'react';
import { Check, ChevronLeft, ChevronRight, Delete, LoaderCircle } from 'lucide-react';
import { type Category, type Expense, parseAmount, today } from './lib/model';
import { errorMessage, saveExpense } from './lib/store';

const categoriesPerPage = 10;

export default function MobileExpenseEntry({
  categories,
  amount,
  setAmount,
  userId,
  userName,
  demo,
  renderCategoryIcon,
  onSave,
}: {
  categories: Category[];
  amount: string;
  setAmount: Dispatch<SetStateAction<string>>;
  userId: string;
  userName: string;
  demo: boolean;
  renderCategoryIcon: (category: Category) => React.ReactNode;
  onSave: (expense: Expense) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const pageCount = Math.max(1, Math.ceil(categories.length / categoriesPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleCategories = categories.slice(
    currentPage * categoriesPerPage,
    (currentPage + 1) * categoriesPerPage,
  );
  const categoryRows = Math.max(1, Math.ceil(visibleCategories.length / 2));
  const kopecks = parseAmount(amount);
  const selectedCategoryId = categories.some((c) => c.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? '');
  const selected = !!selectedCategoryId;
  const display = Number(amount || '0').toLocaleString('en-US');

  function press(key: string) {
    if (locked.current) return;
    setError('');
    setAmount((previous) => {
      if (key === 'erase') return previous.slice(0, -1);
      const next = previous === '0' ? key : previous + key;
      return /^\d{1,9}$/.test(next) ? next : previous;
    });
  }
  async function submit() {
    if (locked.current || kopecks === null || !selected) return;
    if (!userName.trim()) {
      setError('Укажите свое имя при входе.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const expense: Expense = {
        id: crypto.randomUUID(),
        user_id: userId,
        category_id: selectedCategoryId,
        amount_kopecks: kopecks,
        spent_on: today(),
        note: '',
        device_name: userName,
        created_at: new Date().toISOString(),
      };
      await saveExpense(demo, expense, false);
      setAmount((current) => (current === amount ? '' : current));
      await onSave(expense);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={`quick-entry ${pageCount > 1 ? 'has-category-pages' : ''} ${!categories.length ? 'has-no-categories' : ''}`}
      style={{ '--quick-category-rows': categoryRows } as CSSProperties}
      aria-label="Новая трата"
    >
      <div className="quick-amount-row">
        <div className="quick-amount" data-length={display.length > 11 ? 'long' : 'short'}>
          <output aria-label="Сумма траты" aria-live="polite" className={amount ? '' : 'is-empty'}>
            {display}
          </output>
          <span className="amount-caret" aria-hidden="true" />
          <span className="quick-currency" aria-hidden="true">
            ₽
          </span>
        </div>
      </div>
      <div className="quick-categories">
        <div className="quick-category-grid" aria-label="Категории трат">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              className={`quick-category ${selectedCategoryId === category.id ? 'selected' : ''}`}
              style={
                {
                  '--quick-category-selected-bg': `${category.color}18`,
                  '--quick-category-selected-border': `${category.color}40`,
                } as CSSProperties
              }
              aria-pressed={selectedCategoryId === category.id}
              disabled={busy}
              onClick={() => {
                setCategoryId(category.id);
                setError('');
              }}
            >
              {renderCategoryIcon(category)}
              <span className="quick-category-name">{category.name}</span>
              {selectedCategoryId === category.id && (
                <Check
                  className="quick-category-check"
                  size={16}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        {!categories.length && (
          <p className="quick-empty">Добавьте категории на вкладке «Категории».</p>
        )}
        {pageCount > 1 && (
          <div className="quick-category-pages">
            <button
              aria-label="Предыдущие категории"
              disabled={busy || currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <button
              aria-label="Следующие категории"
              disabled={busy || currentPage === pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="quick-error" role="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}
      <div className="expense-keypad" role="group" aria-label="Цифровая клавиатура">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'erase', '0'].map((key) => (
          <button
            key={key}
            disabled={busy}
            aria-label={key === 'erase' ? 'Удалить цифру' : key}
            onClick={() => press(key)}
          >
            {key === 'erase' ? <Delete size={23} /> : key}
          </button>
        ))}
        <button
          className="keypad-submit"
          aria-label="Сохранить трату"
          disabled={busy || kopecks === null || !selected}
          onClick={() => void submit()}
        >
          {busy ? (
            <LoaderCircle className="keypad-spinner" size={26} />
          ) : (
            <Check size={28} strokeWidth={2.2} />
          )}
        </button>
      </div>
    </section>
  );
}
