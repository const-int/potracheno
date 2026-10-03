import { useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Delete, LoaderCircle } from 'lucide-react';
import { type Category, parseAmount, today } from './lib/model';
import { errorMessage, saveExpense } from './lib/store';

export default function MobileExpenseEntry({
  categories,
  userId,
  userName,
  demo,
  renderCategoryIcon,
  onSave,
}: {
  categories: Category[];
  userId: string;
  userName: string;
  demo: boolean;
  renderCategoryIcon: (category: Category) => React.ReactNode;
  onSave: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const pageCount = Math.max(1, Math.ceil(categories.length / 8));
  const currentPage = Math.min(page, pageCount - 1);
  const kopecks = parseAmount(amount);
  const selected = categories.some((c) => c.id === categoryId);
  const [rubles, fraction] = (amount || '0').split('.');
  const display =
    Number(rubles).toLocaleString('en-US') + (fraction !== undefined ? '.' + fraction : '');

  function press(key: string) {
    if (locked.current) return;
    setError('');
    setAmount((previous) => {
      if (key === '.') return previous.includes('.') ? previous : (previous || '0') + '.';
      const next = previous === '0' ? key : previous + key;
      return /^\d{1,9}(\.\d{0,2})?$/.test(next) ? next : previous;
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
      await saveExpense(
        demo,
        {
          id: crypto.randomUUID(),
          user_id: userId,
          category_id: categoryId,
          amount_kopecks: kopecks,
          spent_on: today(),
          note: '',
          device_name: userName,
          created_at: new Date().toISOString(),
        },
        false,
      );
      setAmount('');
      await onSave();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="quick-entry" aria-label="Новый расход">
      <div className="quick-amount-row">
        <div className="quick-amount" data-length={display.length > 11 ? 'long' : 'short'}>
          <output
            aria-label="Сумма расхода"
            aria-live="polite"
            className={amount ? '' : 'is-empty'}
          >
            {display}
          </output>
          <span className="amount-caret" aria-hidden="true" />
          <span className="quick-currency" aria-hidden="true">
            ₽
          </span>
        </div>
        <button
          className="quick-erase"
          aria-label="Удалить цифру"
          disabled={busy || !amount}
          onClick={() => {
            setError('');
            setAmount((value) => value.slice(0, -1));
          }}
        >
          <Delete size={23} />
        </button>
      </div>
      <div className="quick-categories">
        <div className="quick-category-grid" aria-label="Категории расходов">
          {categories.slice(currentPage * 8, currentPage * 8 + 8).map((category) => (
            <button
              key={category.id}
              className={`quick-category ${categoryId === category.id ? 'selected' : ''}`}
              aria-pressed={categoryId === category.id}
              disabled={busy}
              onClick={() => {
                setCategoryId(category.id);
                setError('');
              }}
            >
              {renderCategoryIcon(category)}
              <span>{category.name}</span>
            </button>
          ))}
        </div>
        {!categories.length && (
          <p className="quick-empty">Добавьте категории на вкладке «Категории».</p>
        )}
        <div className="quick-category-pages">
          {pageCount > 1 && (
            <>
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
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="quick-error" role="alert" onClick={() => setError('')}>
          {error}
        </div>
      )}
      <div className="expense-keypad" role="group" aria-label="Цифровая клавиатура">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((key) => (
          <button
            key={key}
            disabled={busy}
            aria-label={key === '.' ? 'Десятичная точка' : key}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
        <button
          className="keypad-submit"
          aria-label="Сохранить расход"
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
