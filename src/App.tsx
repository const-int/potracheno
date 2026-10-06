import { useMobileViewport } from './lib/use-mobile-viewport';
import CategoryTreemap from './CategoryTreemap';
import HistoryCategoryFilter from './HistoryCategoryFilter';
import SortableCategoryList from './SortableCategoryList';
import Toast, { type ToastNotice } from './Toast';
import { useRegisterSW } from 'virtual:pwa-register/react';
import CsvImport from './CsvImport';
import MobileExpenseEntry from './MobileExpenseEntry';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Car,
  Fuel,
  Star,
  Bike,
  Zap,
  Puzzle,
  Compass,
  Lightbulb,
  BookOpen,
  Palette,
  Wrench,
  Gamepad2,
  Gem,
  Sparkles,
  Flag,
  Box,
  Clover,
  Save,
  Bus,
  UtensilsCrossed,
  Shirt,
  Plane,
  GraduationCap,
  Dumbbell,
  Gift,
  PartyPopper,
  ReceiptText,
  Smartphone,
  BriefcaseBusiness,
  Check,
  Coffee,
  Download,
  FileUp,
  HeartPulse,
  Home,
  LayoutGrid,
  createLucideIcon,
  Asterisk,
  Leaf,
  List,
  LogOut,
  Cat,
  Pencil,
  Plus,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  UserRound,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  type Category,
  type Data,
  type Expense,
  categoryColorOptions,
  categoryIconColor,
  swatchCheckColor,
  categoryIconLabels,
  categoryIconOptions,
  csv,
  money,
  monthLabel,
  historyDayLabel,
  parseAmount,
  shiftMonth,
  summarize,
  expenseHighlights,
  annualHighlights,
  today,
} from './lib/model';
import {
  deleteExpense,
  deleteCategory,
  reorderCategories,
  errorMessage,
  loadData,
  saveCategory,
  saveExpense,
  seedCategories,
  supabase,
} from './lib/store';

const RoundedLayoutGrid = createLucideIcon('RoundedLayoutGrid', [
  ['rect', { width: '7', height: '7', x: '3', y: '3', rx: '2.5', key: 'top-left' }],
  ['rect', { width: '7', height: '7', x: '14', y: '3', rx: '2.5', key: 'top-right' }],
  ['rect', { width: '7', height: '7', x: '14', y: '14', rx: '2.5', key: 'bottom-right' }],
  ['rect', { width: '7', height: '7', x: '3', y: '14', rx: '2.5', key: 'bottom-left' }],
]);
const icons = {
  basket: ShoppingBasket,
  shop: ShoppingCart,
  car: Car,
  heart: HeartPulse,
  paw: Cat,
  home: Home,
  coffee: Coffee,
  other: Asterisk,
  fuel: Fuel,
  star: Star,
  bike: Bike,
  lightning: Zap,
  puzzle: Puzzle,
  compass: Compass,
  lightbulb: Lightbulb,
  book: BookOpen,
  palette: Palette,
  tools: Wrench,
  gamepad: Gamepad2,
  diamond: Gem,
  sparkles: Sparkles,
  hexagon: Flag,
  cube: Box,
  clover: Clover,
  transport: Bus,
  food: UtensilsCrossed,
  clothes: Shirt,
  travel: Plane,
  study: GraduationCap,
  sport: Dumbbell,
  gifts: Gift,
  fun: PartyPopper,
  bills: ReceiptText,
  phone: Smartphone,
  work: BriefcaseBusiness,
};
function CategoryIcon({ category, size = 20 }: { category?: Category; size?: number }) {
  const Icon = icons[category?.icon as keyof typeof icons] ?? icons.other;
  return (
    <span
      className="category-icon"
      style={{
        color: categoryIconColor(category?.color ?? '#806697'),
        backgroundColor: `${category?.color ?? '#806697'}18`,
      }}
    >
      <Icon size={size} />
    </span>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={close} aria-label="Закрыть">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const empty: Data = { categories: [], expenses: [] };
type Tab = 'add' | 'history' | 'summary' | 'categories';

export default function App() {
  const {
    needRefresh: [updateReady],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const check = () => {
      if (document.visibilityState === 'visible') {
        void navigator.serviceWorker
          .getRegistration()
          .then((registration) => registration?.update())
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [data, setData] = useState<Data>(empty);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('add');
  const [expenseDraft, setExpenseDraft] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const changed = () => setIsMobile(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const quickEntry = isMobile && tab === 'add';
  const [month, setMonth] = useState(today().slice(0, 7));
  const [summaryPeriod, setSummaryPeriod] = useState<'month' | 'year'>('month');
  const [historyCategoryIds, setHistoryCategoryIds] = useState<string[]>([]);
  const [userName, setUserName] = useState(() => localStorage.getItem('vmeste.device') ?? '');
  const [settings, setSettings] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [notice, setNoticeState] = useState<ToastNotice | null>(null);
  const noticeSequence = useRef(0);
  function setNotice(
    message: string,
    kind: ToastNotice['kind'] = 'success',
    placement?: 'expense',
  ) {
    setNoticeState(message ? { id: ++noticeSequence.current, message, kind, placement } : null);
  }
  const closeNotice = useCallback((id: number) => {
    setNoticeState((current) => (current?.id === id ? null : current));
  }, []);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const categoryOrderSaving = useRef(false);
  const session = demo ? 'demo' : userId;
  useMobileViewport(isMobile && !!session, quickEntry && !!session && !!userName.trim());
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [tab]);
  useEffect(() => {
    if (tab !== 'add' || !session)
      setNoticeState((current) => (current?.placement === 'expense' ? null : current));
  }, [tab, session, notice?.id]);
  const activeSession = useRef(session);
  activeSession.current = session;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) {
          setUserId(data.session?.user.id ?? null);
          setAuthLoading(false);
          if (error) setNotice(errorMessage(error), 'error');
        }
      })
      .catch((e) => {
        if (active) {
          setAuthLoading(false);
          setNotice(errorMessage(e), 'error');
        }
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!session || activeSession.current !== session) return;
    const current = generation.current;
    if (inFlight.current) {
      await inFlight.current;
    }
    if (current !== generation.current || activeSession.current !== session) return;
    const task = (async () => {
      try {
        const result = await loadData(demo);
        if (current === generation.current && !categoryOrderSaving.current) {
          setData(result);
          setLoaded(true);
          setLoadError('');
        }
      } catch (e) {
        if (current === generation.current) setLoadError(errorMessage(e));
      }
    })();
    inFlight.current = task;
    await task;
    if (inFlight.current === task) inFlight.current = null;
  }, [session, demo]);

  useEffect(() => {
    generation.current += 1;
    setExpenseDraft('');
    setData(empty);
    setLoaded(false);
    setLoadError('');
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (demo && event.key === 'vmeste.demo.v1') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      generation.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh, demo]);

  const monthExpenses = data.expenses
    .filter((e) => e.spent_on.startsWith(month))
    .sort(
      (a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at),
    );
  const selectedHistoryCategories = historyCategoryIds.filter((id) =>
    data.categories.some((category) => category.id === id),
  );
  const historyExpenses = selectedHistoryCategories.length
    ? monthExpenses.filter((expense) => selectedHistoryCategories.includes(expense.category_id))
    : monthExpenses;
  const historyTotal = historyExpenses.reduce((sum, expense) => sum + expense.amount_kopecks, 0);
  const historyDayGroups: { date: string; expenses: Expense[] }[] = [];
  for (const expense of historyExpenses) {
    const group = historyDayGroups[historyDayGroups.length - 1];
    if (group?.date === expense.spent_on) group.expenses.push(expense);
    else historyDayGroups.push({ date: expense.spent_on, expenses: [expense] });
  }

  const yearlySummary = tab === 'summary' && summaryPeriod === 'year';
  const firstExpenseMonth = data.expenses.reduce(
    (first, expense) => {
      const expenseMonth = expense.spent_on.slice(0, 7);
      return expenseMonth < first ? expenseMonth : first;
    },
    today().slice(0, 7),
  );
  const canGoBack = yearlySummary
    ? month.slice(0, 4) > firstExpenseMonth.slice(0, 4)
    : month > firstExpenseMonth;
  useEffect(() => {
    if (!loaded || (tab !== 'history' && tab !== 'summary')) return;
    if (
      yearlySummary ? month.slice(0, 4) < firstExpenseMonth.slice(0, 4) : month < firstExpenseMonth
    )
      setMonth(firstExpenseMonth);
  }, [loaded, tab, yearlySummary, month, firstExpenseMonth]);
  const summaryExpenses = yearlySummary
    ? data.expenses.filter((e) => e.spent_on.startsWith(`${month.slice(0, 4)}-`))
    : monthExpenses;
  const summaryTotal = summaryExpenses.reduce((sum, e) => sum + e.amount_kopecks, 0);
  const categoryById = (id: string) => data.categories.find((c) => c.id === id);
  const activeCategories = data.categories;
  async function afterSave(text: string, placement?: 'expense') {
    await refresh();
    setNotice(text, 'success', placement);
  }
  async function exportData() {
    setExportBusy(true);
    try {
      const fresh = await loadData(demo);
      const blob = new Blob([csv(fresh)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-expenses-${today()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Все траты экспортированы');
    } catch (e) {
      setNotice(errorMessage(e), 'error');
    } finally {
      setExportBusy(false);
    }
  }
  async function logout() {
    try {
      if (demo) setDemo(false);
      else {
        const { error } = await supabase!.auth.signOut({ scope: 'local' });
        if (error) throw error;
        setUserId(null);
      }
      setSettings(false);
      setEditing(null);
      setEditingCategory(null);
      setData(empty);
      setHistoryCategoryIds([]);
      setTab('add');
    } catch (e) {
      setNotice(errorMessage(e), 'error');
    }
  }

  function rememberName(name: string) {
    const value = name.trim();
    localStorage.setItem('vmeste.device', value);
    setUserName(value);
  }
  function selectTab(next: Tab) {
    if (next === 'history' || next === 'summary') setMonth(today().slice(0, 7));
    if (next === 'summary') setSummaryPeriod('month');
    setTab(next);
  }

  if (session && !userName.trim())
    return (
      <div className="login-page">
        <Brand />
        <section className="login-card name-prompt">
          <h2>Как вас зовут?</h2>
          <NamePrompt userName="" onSave={rememberName} />
        </section>
      </div>
    );

  if (!session)
    return (
      <div className="login-page">
        <div className="login-brand">
          <Brand />
        </div>
        <section className="login-card" aria-label="Вход в приложение">
          {authLoading ? (
            <p role="status">Проверяем вход…</p>
          ) : supabase ? (
            <Login
              userName={userName}
              onNameChange={setUserName}
              onSignedIn={rememberName}
              onError={(message) => setNotice(message, 'error')}
            />
          ) : null}
          <button
            className={supabase ? 'secondary demo-login' : 'primary demo-login'}
            onClick={() => {
              rememberName(userName || 'Демо');
              setDemo(true);
            }}
          >
            Открыть деморежим <ArrowRight size={18} />
          </button>
          <p className="demo-storage-note">
            Демо-данные сохраняются только в этом браузере и не синхронизируются между телефонами.
          </p>
        </section>
        {notice && notice.placement !== 'expense' && (
          <Toast key={notice.id} notice={notice} onClose={closeNotice} />
        )}
      </div>
    );

  return (
    <div className={`app-shell ${quickEntry ? 'mobile-entry' : isMobile ? 'mobile-compact' : ''}`}>
      <aside className="sidebar">
        <Brand />
        <div className="family-badge">
          <div className="avatar">МЫ</div>
          <div>
            <strong>Наша семья</strong>
            <span>Общий бюджет · ₽</span>
          </div>
        </div>
        <div className="nav-label">ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          {(
            [
              ['add', Plus, 'Добавить трату'],
              ['history', List, 'История трат'],
              ['summary', BarChart3, 'Summary'],
              ['categories', LayoutGrid, 'Категории'],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => selectTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
              {id === 'add' && <span className="nav-plus">+</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <Leaf size={23} />
            <strong>
              Маленькие записи.
              <br />
              Большая ясность.
            </strong>
            <p>
              Всё, что важно для вашего
              <br />
              семейного бюджета.
            </p>
          </div>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings size={19} />
            Настройки
          </button>
          <div className="sidebar-caption">С заботой о вашей семье</div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1 className="screen-title">
            {
              {
                add: 'Добавить трату',
                history: 'История трат',
                summary: 'Общие траты',
                categories: 'Категории трат',
              }[tab]
            }
          </h1>
          <button
            className="icon-button settings-button"
            aria-label="Настройки"
            onClick={() => setSettings(true)}
          >
            <Settings size={19} />
          </button>
        </header>
        <div className="content">
          {demo && !isMobile && (
            <div className="demo-banner">
              <span>
                <strong>Деморежим</strong> · данные только в этом браузере
              </span>
              <button onClick={logout}>
                Выйти <ArrowRight size={14} />
              </button>
            </div>
          )}
          {loadError && (
            <div className="error-banner" role="alert">
              <span>
                {loadError}
                {loaded && ' Показаны последние загруженные данные.'}
              </span>
              <button onClick={() => void refresh()}>Повторить</button>
            </div>
          )}
          {!isMobile && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">СЕМЕЙНЫЕ ФИНАНСЫ</div>
                <h1>
                  {
                    {
                      add: 'Каждая трата на своем месте',
                      history: 'История трат',
                      summary: 'Общие траты',
                      categories: 'Ваши категории',
                    }[tab]
                  }
                </h1>
                <p>
                  {
                    {
                      add: 'Запишите сейчас — и не держите цифры в голове.',
                      history: 'Все ваши покупки и маленькие радости.',
                      summary: 'Посмотрите, как складывается ваш месяц.',
                      categories: 'Настройте учет под привычки вашей семьи.',
                    }[tab]
                  }
                </p>
              </div>
              {tab === 'history' && (
                <button
                  className="secondary export-button"
                  onClick={exportData}
                  disabled={exportBusy}
                >
                  <Download size={17} />
                  {exportBusy ? 'Экспорт…' : 'Экспорт CSV'}
                </button>
              )}
            </div>
          )}
          {!loaded ? (
            <div className="panel empty-state" role="status">
              {loadError ? 'Не удалось загрузить траты.' : 'Загружаем семейные траты…'}
            </div>
          ) : (
            <>
              {quickEntry && (
                <MobileExpenseEntry
                  amount={expenseDraft}
                  setAmount={setExpenseDraft}
                  categories={activeCategories}
                  userId={session!}
                  userName={userName}
                  demo={demo}
                  renderCategoryIcon={(category) => <CategoryIcon category={category} size={19} />}
                  onSave={() => afterSave('Трата сохранена', 'expense')}
                />
              )}
              {tab === 'add' && !isMobile && (
                <div className="entry-layout">
                  <section className="panel entry-panel">
                    <div className="section-heading">
                      <h2>
                        <span className="heading-symbol">
                          <Plus size={18} />
                        </span>
                        Новая трата
                      </h2>
                      <span className="pill">₽ RUB</span>
                    </div>
                    <ExpenseForm
                      draftAmount={expenseDraft}
                      onDraftAmountChange={setExpenseDraft}
                      categories={activeCategories}
                      userId={session!}
                      demo={demo}
                      userName={userName}
                      onSave={() => afterSave('Трата сохранена', 'expense')}
                    />
                  </section>
                  <aside className="entry-aside">
                    <section className="monthly-card">
                      <div className="eyebrow light">ЭТОТ МЕСЯЦ</div>
                      <div className="monthly-title">{monthLabel(today().slice(0, 7))}</div>
                      <div className="monthly-amount">
                        {money(
                          data.expenses
                            .filter((e) => e.spent_on.startsWith(today().slice(0, 7)))
                            .reduce((s, e) => s + e.amount_kopecks, 0),
                        )}
                      </div>
                      <span>Общие траты семьи</span>
                      <div className="monthly-divider" />
                      <button
                        onClick={() => {
                          setMonth(today().slice(0, 7));
                          setTab('summary');
                        }}
                      >
                        Посмотреть статистику <ArrowRight size={18} />
                      </button>
                      <div className="card-decoration" />
                    </section>
                    <section className="panel latest-panel">
                      <div className="section-heading">
                        <h2>Последние записи</h2>
                        <button
                          className="text-button"
                          onClick={() => {
                            setMonth(today().slice(0, 7));
                            setTab('history');
                          }}
                        >
                          Все <ArrowRight size={14} />
                        </button>
                      </div>
                      {data.expenses
                        .slice()
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .slice(0, 3)
                        .map((e) => (
                          <div className="mini-expense" key={e.id}>
                            <CategoryIcon category={categoryById(e.category_id)} />
                            <div>
                              <strong>{categoryById(e.category_id)?.name}</strong>
                              <span>{e.device_name}</span>
                            </div>
                            <b>{money(e.amount_kopecks)}</b>
                          </div>
                        ))}
                      {!data.expenses.length && (
                        <p className="muted">Здесь появятся ваши первые траты.</p>
                      )}
                    </section>
                    <div className="help-note">
                      <Check size={17} />
                      <p>
                        {demo
                          ? 'Можно попробовать всё: добавление, категории и статистику.'
                          : 'Траты доступны на обоих телефонах. Список обновляется каждые 30 секунд и при возвращении в приложение.'}
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              {(tab === 'history' || tab === 'summary') && (
                <>
                  <div className={`period-row ${tab === 'summary' ? 'summary-period-row' : ''}`}>
                    <div className="month-switch">
                      <button
                        type="button"
                        disabled={!canGoBack}
                        onClick={() =>
                          setMonth((previous) => {
                            const next = shiftMonth(previous, yearlySummary ? -12 : -1);
                            const withinRange = yearlySummary
                              ? next.slice(0, 4) >= firstExpenseMonth.slice(0, 4)
                              : next >= firstExpenseMonth;
                            return withinRange ? next : firstExpenseMonth;
                          })
                        }
                        aria-label={yearlySummary ? 'Предыдущий год' : 'Предыдущий месяц'}
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <span>{yearlySummary ? month.slice(0, 4) : monthLabel(month)}</span>
                      {(
                        yearlySummary
                          ? month.slice(0, 4) < today().slice(0, 4)
                          : month < today().slice(0, 7)
                      ) ? (
                        <button
                          onClick={() =>
                            setMonth((previous) => {
                              const next = shiftMonth(previous, yearlySummary ? 12 : 1);
                              const current = today().slice(0, 7);
                              return next > current ? current : next;
                            })
                          }
                          aria-label={yearlySummary ? 'Следующий год' : 'Следующий месяц'}
                        >
                          <ArrowRight size={17} />
                        </button>
                      ) : (
                        <div className="month-next-placeholder" aria-hidden="true" />
                      )}
                    </div>
                    {tab === 'summary' && (
                      <div className="period-toggle" role="group" aria-label="Период статистики">
                        {(['month', 'year'] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            aria-pressed={summaryPeriod === period}
                            onClick={() => {
                              setSummaryPeriod(period);
                              if (period === 'month')
                                setMonth((previous) =>
                                  previous < firstExpenseMonth
                                    ? firstExpenseMonth
                                    : previous > today().slice(0, 7)
                                      ? today().slice(0, 7)
                                      : previous,
                                );
                            }}
                          >
                            {period === 'month' ? 'Месяц' : 'Год'}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isMobile && tab === 'history' && (
                      <span className="muted">{historyExpenses.length} записей</span>
                    )}
                    {isMobile && tab === 'history' && (
                      <strong className="period-total">{money(historyTotal)}</strong>
                    )}
                  </div>
                  {tab === 'summary' ? (
                    <Summary
                      expenses={summaryExpenses}
                      categories={data.categories}
                      total={summaryTotal}
                      year={yearlySummary ? month.slice(0, 4) : undefined}
                      compact={isMobile}
                    />
                  ) : (
                    <>
                      <HistoryCategoryFilter
                        categories={data.categories}
                        selected={selectedHistoryCategories}
                        onChange={setHistoryCategoryIds}
                        renderIcon={(category) => <CategoryIcon category={category} size={19} />}
                      />
                      <section className="history-content" aria-label="История трат">
                        {!isMobile && (
                          <div className="section-heading">
                            <h2>Траты за месяц</h2>
                            <strong className="history-total">{money(historyTotal)}</strong>
                          </div>
                        )}
                        {!historyExpenses.length && (
                          <div className="panel history-panel">
                            {selectedHistoryCategories.length ? (
                              <div className="history-filter-empty">
                                <p>Нет трат в выбранных категориях за этот месяц.</p>
                              </div>
                            ) : (
                              <Empty onClick={() => setTab('add')} />
                            )}
                          </div>
                        )}
                        <div className="history-days">
                          {historyDayGroups.map((group) => (
                            <section
                              className="history-day-group"
                              key={group.date}
                              aria-label={historyDayLabel(group.date)}
                            >
                              <h3 className="history-day-label">{historyDayLabel(group.date)}</h3>
                              <div className="panel history-panel">
                                <div className="expense-list">
                                  {group.expenses.map((e) => (
                                    <div className="expense-row" key={e.id}>
                                      <CategoryIcon category={categoryById(e.category_id)} />
                                      <div className="expense-info">
                                        <strong>
                                          {categoryById(e.category_id)?.name ?? 'Категория'}
                                        </strong>
                                        <span>
                                          <time
                                            dateTime={e.created_at}
                                            title="Время добавления записи"
                                          >
                                            {new Intl.DateTimeFormat('ru-RU', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              hourCycle: 'h23',
                                            }).format(new Date(e.created_at))}
                                          </time>{' '}
                                          · {e.device_name}
                                        </span>
                                      </div>
                                      <b
                                        className={`expense-amount ${money(e.amount_kopecks).length > 9 ? 'is-long' : ''}`}
                                      >
                                        {money(e.amount_kopecks)}
                                      </b>
                                      <div className="row-actions">
                                        <button
                                          className="icon-button expense-edit-button"
                                          aria-label={`Редактировать ${categoryById(e.category_id)?.name}`}
                                          onClick={() => setEditing(e)}
                                        >
                                          <Pencil size={20} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </section>
                          ))}
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}
              {tab === 'categories' && (
                <section className="panel categories-panel">
                  {!isMobile && (
                    <div className="section-heading">
                      <h2>Категории трат</h2>
                    </div>
                  )}
                  <SortableCategoryList
                    categories={data.categories}
                    expenses={data.expenses}
                    renderIcon={(category) => <CategoryIcon category={category} />}
                    onEdit={setEditingCategory}
                    onReorder={async (categories) => {
                      const previous = data.categories;
                      const current = generation.current;
                      categoryOrderSaving.current = true;
                      setData((data) => ({ ...data, categories }));
                      try {
                        await reorderCategories(
                          demo,
                          categories.map((category) => category.id),
                        );
                        if (current === generation.current) setNotice('Порядок категорий сохранён');
                      } catch (error) {
                        if (current === generation.current) {
                          setData((data) => ({ ...data, categories: previous }));
                          setNotice(errorMessage(error), 'error');
                        }
                      } finally {
                        categoryOrderSaving.current = false;
                        if (current === generation.current) await refresh();
                      }
                    }}
                  />
                  {!data.categories.length && (
                    <SeedButton userId={session!} demo={demo} onSave={() => refresh()} />
                  )}
                  <div className="categories-actions">
                    <button className="primary compact" onClick={() => setEditingCategory('new')}>
                      <Plus size={17} />
                      Добавить
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          {!isMobile && (
            <footer className="content-footer">
              <Leaf size={14} /> Вместе проще.
            </footer>
          )}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Мобильная навигация">
        {(
          [
            ['add', Plus, 'Трата'],
            ['history', List, 'История'],
            ['summary', BarChart3, 'Потрачено'],
            ['categories', RoundedLayoutGrid, 'Категории'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => selectTab(id)}
          >
            <Icon size={21} strokeWidth={id === 'categories' ? 1.75 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {notice && (notice.placement !== 'expense' || tab === 'add') && (
        <Toast key={notice.id} notice={notice} onClose={closeNotice} />
      )}
      {editing && (
        <Modal
          title="Редактировать трату"
          close={() => {
            if (!editorBusy) setEditing(null);
          }}
        >
          <ExpenseForm
            categories={data.categories}
            userId={session!}
            demo={demo}
            userName={userName}
            existing={editing}
            onBusy={setEditorBusy}
            onDelete={async () => {
              setEditing(null);
              await afterSave('Трата удалена');
            }}
            onSave={async () => {
              setEditing(null);
              await afterSave('Трата обновлена');
            }}
          />
        </Modal>
      )}
      {editingCategory && (
        <Modal
          title={editingCategory === 'new' ? 'Новая категория' : 'Изменить категорию'}
          close={() => {
            if (!editorBusy) setEditingCategory(null);
          }}
        >
          <CategoryForm
            userId={session!}
            demo={demo}
            existing={editingCategory === 'new' ? undefined : editingCategory}
            onBusy={setEditorBusy}
            hasExpenses={
              editingCategory !== 'new' &&
              data.expenses.some((expense) => expense.category_id === editingCategory.id)
            }
            onDelete={async () => {
              setEditingCategory(null);
              await afterSave('Категория удалена');
            }}
            onSave={async () => {
              setEditingCategory(null);
              await afterSave('Категория сохранена');
            }}
          />
        </Modal>
      )}
      {importOpen && (
        <Modal
          title="Импорт трат"
          close={() => {
            if (!importBusy) setImportOpen(false);
          }}
        >
          <CsvImport
            data={data}
            demo={demo}
            userId={session!}
            userName={userName}
            onBusy={setImportBusy}
            onComplete={async ({ imported, skipped }) => {
              setImportOpen(false);
              await afterSave(`Импортировано трат: ${imported}. Пропущено совпадений: ${skipped}.`);
            }}
          />
        </Modal>
      )}
      {settings && (
        <Modal title="Настройки" close={() => setSettings(false)}>
          <NamePrompt
            userName={userName}
            onLogout={logout}
            onSave={(name) => {
              rememberName(name);
              setNotice('Имя пользователя сохранено');
            }}
          />
          <div className="settings-separator" />
          <div className="settings-actions">
            {updateReady && (
              <button className="primary full-width" onClick={() => void updateServiceWorker(true)}>
                Обновить приложение
              </button>
            )}
            <button className="secondary full-width" onClick={exportData} disabled={exportBusy}>
              <Download size={17} />
              {exportBusy ? 'Экспорт…' : 'Экспорт трат в CSV'}
            </button>
            <button
              className="secondary full-width"
              onClick={() => {
                setSettings(false);
                setImportOpen(true);
              }}
            >
              <FileUp size={17} />
              Импорт трат из CSV
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span>
        <Wallet size={23} />
      </span>
      potracheno<span className="brand-period">.</span>
    </div>
  );
}
function Login({
  userName,
  onNameChange,
  onSignedIn,
  onError,
}: {
  userName: string;
  onNameChange: (name: string) => void;
  onSignedIn: (name: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const name = userName.trim();
    if (!name) {
      onError('Укажите свое имя.');
      return;
    }
    onError('');
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email: String(values.get('email')).trim(),
        password: String(values.get('password')),
      });
      if (error) throw error;
      onSignedIn(name);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="family@example.com"
        />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Ваш общий пароль"
        />
      </label>
      <label>
        Имя пользователя
        <input
          name="display_name"
          autoComplete="name"
          value={userName}
          onChange={(e) => onNameChange(e.target.value)}
          required
          maxLength={40}
          placeholder="Например, Анна"
          disabled={busy}
        />
      </label>
      <button className="primary full-width" disabled={busy}>
        {busy ? 'Входим…' : 'Войти'}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
function ExpenseForm({
  categories,
  userId,
  demo,
  userName,
  existing,
  onSave,
  onDelete,
  onBusy,
  draftAmount,
  onDraftAmountChange,
}: {
  categories: Category[];
  userId: string;
  demo: boolean;
  userName: string;
  existing?: Expense;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onBusy?: (busy: boolean) => void;
  draftAmount?: string;
  onDraftAmountChange?: Dispatch<SetStateAction<string>>;
}) {
  const [localAmount, setLocalAmount] = useState(
    existing ? String(Math.ceil(existing.amount_kopecks / 100)) : '',
  );
  const amount = existing ? localAmount : (draftAmount ?? localAmount);
  const setAmount = !existing && onDraftAmountChange ? onDraftAmountChange : setLocalAmount;
  const [amountEdited, setAmountEdited] = useState(false);
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? categories[0]?.id ?? '');
  const [date, setDate] = useState(existing?.spent_on ?? today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setError('');
    const kopecks = existing && !amountEdited ? existing.amount_kopecks : parseAmount(amount);
    if (kopecks === null || ((!existing || amountEdited) && kopecks % 100 !== 0)) {
      setError('Укажите целую сумму в рублях от 1 до 999,999,999 ₽.');
      return;
    }
    if (!categories.some((c) => c.id === categoryId)) {
      setError('Выберите категорию.');
      return;
    }
    if (!userName && !existing) {
      setError('Укажите свое имя, чтобы видеть, кто добавил трату.');
      return;
    }
    submitLock.current = true;
    setBusy(true);
    try {
      await saveExpense(
        demo,
        {
          id: existing?.id ?? crypto.randomUUID(),
          user_id: userId,
          amount_kopecks: kopecks,
          category_id: categoryId,
          spent_on: date,
          note: existing?.note ?? '',
          device_name: existing?.device_name ?? userName,
          created_at: existing?.created_at ?? new Date().toISOString(),
        },
        !!existing,
      );
      if (!existing) {
        setAmount((current) => (current === amount ? '' : current));
        setDate(today());
      }
      await onSave();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }
  return (
    <form className={`expense-form ${existing ? 'expense-edit-form' : ''}`} onSubmit={submit}>
      <fieldset disabled={busy}>
        {!existing && (
          <label className="amount-label" htmlFor="amount">
            Сумма траты
          </label>
        )}
        <div className="amount-input">
          <input
            id="amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label="Сумма траты"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountEdited(true);
            }}
            required
          />
          <span>₽</span>
        </div>
        <div className="field-heading">
          Категория <span>Выберите одну</span>
        </div>
        <div className="category-picker">
          {categories.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`category-choice ${categoryId === c.id ? 'selected' : ''}`}
              onClick={() => setCategoryId(c.id)}
              aria-pressed={categoryId === c.id}
            >
              {!existing && <CategoryIcon category={c} size={22} />}
              <span>{c.name}</span>
              {!existing && categoryId === c.id && <Check className="category-check" size={13} />}
            </button>
          ))}
        </div>
        {!categories.length && (
          <p className="form-error">Сначала добавьте категории на вкладке «Категории».</p>
        )}
        <label>
          Дата траты
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>

        {!existing && (
          <div className="form-author">
            <UserRound size={15} />
            {userName || 'Имя пока не указано'}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {existing ? (
          <div className="category-form-actions">
            {onDelete && (
              <button
                type="button"
                className="danger"
                aria-label="Удалить трату"
                disabled={busy}
                onClick={async () => {
                  if (submitLock.current) return;
                  submitLock.current = true;
                  setBusy(true);
                  setError('');
                  try {
                    await deleteExpense(demo, existing.id);
                    await onDelete();
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                    submitLock.current = false;
                  }
                }}
              >
                <Trash2 size={17} />
                {busy ? 'Подождите…' : 'Удалить'}
              </button>
            )}
            <button
              className="primary save-expense"
              aria-label="Сохранить изменения"
              disabled={busy || !categories.length}
            >
              <Save size={17} />
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        ) : (
          <button className="primary full-width save-expense" disabled={busy || !categories.length}>
            <Plus size={19} />
            {busy ? 'Сохраняем…' : 'Добавить трату'}
          </button>
        )}
      </fieldset>
    </form>
  );
}
function CategoryForm({
  existing,
  userId,
  demo,
  onSave,
  onDelete,
  onBusy,
  hasExpenses,
}: {
  existing?: Category;
  userId: string;
  demo: boolean;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onBusy: (busy: boolean) => void;
  hasExpenses: boolean;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? categoryColorOptions[0]);
  const colorOptions =
    existing?.color && !categoryColorOptions.includes(existing.color)
      ? [...categoryColorOptions.slice(0, -1), existing.color]
      : categoryColorOptions;
  const [icon, setIcon] = useState(existing?.icon ?? 'other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionLock = useRef(false);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  return (
    <form
      className="category-edit-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || actionLock.current || confirmDelete) return;
        actionLock.current = true;
        setBusy(true);
        setError('');
        try {
          await saveCategory(
            demo,
            {
              id: existing?.id ?? crypto.randomUUID(),
              user_id: userId,
              name: name.trim(),
              color,
              icon,
              archived: false,
            },
            !!existing,
          );
          await onSave();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
          actionLock.current = false;
        }
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Название
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            placeholder="Например, путешествия"
          />
        </label>
        <div className="field-heading">Цвет</div>
        <div className="swatch-list">
          {colorOptions.map((c) => (
            <button
              type="button"
              key={c}
              style={{ background: c, color: swatchCheckColor(c) }}
              className={c === color ? 'selected' : ''}
              aria-label={`Цвет ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            >
              {c === color && <Check size={15} />}
            </button>
          ))}
        </div>
        <div className="field-heading">Значок</div>
        <div className="icon-picker">
          {(categoryIconOptions.includes(icon)
            ? categoryIconOptions
            : [icon, ...categoryIconOptions]
          ).map((id) => {
            const Icon = icons[id as keyof typeof icons] ?? icons.other;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setIcon(id)}
                aria-label={`Значок ${categoryIconLabels[id]}`}
                title={categoryIconLabels[id]}
                aria-pressed={icon === id}
                className={icon === id ? 'selected' : ''}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="category-form-actions">
          {existing && (
            <button
              type="button"
              className="danger"
              aria-label="Удалить категорию"
              disabled={busy || confirmDelete}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={17} />
              Удалить
            </button>
          )}
          <button
            className="primary"
            aria-label="Сохранить категорию"
            disabled={busy || !name.trim() || confirmDelete}
          >
            <Save size={17} />
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
        {existing && confirmDelete && (
          <div className="category-delete-confirm">
            <p className="muted">
              {hasExpenses
                ? `В категории «${existing.name}» есть траты. Сначала удалите их или выберите для них другую категорию.`
                : `Удалить категорию «${existing.name}»? Это действие нельзя отменить.`}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy || hasExpenses}
                onClick={async () => {
                  if (actionLock.current) return;
                  actionLock.current = true;
                  setBusy(true);
                  setError('');
                  try {
                    await deleteCategory(demo, existing.id);
                    await onDelete();
                  } catch (error) {
                    setError(errorMessage(error));
                  } finally {
                    setBusy(false);
                    actionLock.current = false;
                  }
                }}
              >
                {busy ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </form>
  );
}
function NamePrompt({
  userName,
  onSave,
  onLogout,
}: {
  userName: string;
  onSave: (name: string) => void;
  onLogout?: () => Promise<void>;
}) {
  const [name, setName] = useState(userName);
  const inputRef = useRef<HTMLInputElement>(null);
  const changed = name !== userName;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (changed && name.trim()) {
          onSave(name.trim());
          setName(name.trim());
        }
      }}
    >
      {!onLogout && (
        <p className="muted">
          Имя видно рядом с добавленными тратами. Укажите свое имя для подписи трат.
        </p>
      )}
      <div className="name-save-row">
        <div className="name-field">
          <label htmlFor="profile-name">Имя пользователя</label>
          <div className="name-input">
            <input
              id="profile-name"
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              required
              placeholder="Например, Анна"
            />
            {name && (
              <button
                type="button"
                className="name-clear-button"
                aria-label="Очистить имя"
                onClick={() => {
                  setName('');
                  inputRef.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {onLogout && !changed && (
          <button
            type="button"
            className="secondary name-logout-button"
            onClick={() => void onLogout()}
          >
            <LogOut size={17} />
            Выйти
          </button>
        )}
        {changed && (
          <button className="primary" disabled={!name.trim()}>
            Сохранить
          </button>
        )}
      </div>
    </form>
  );
}
function SeedButton({
  userId,
  demo,
  onSave,
}: {
  userId: string;
  demo: boolean;
  onSave: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="empty-state">
      <p>Добавьте свои категории или начните с готового списка.</p>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (!demo) await seedCategories(userId);
            await onSave();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Добавляем…' : 'Добавить базовые категории'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function Empty({ onClick, year = false }: { onClick?: () => void; year?: boolean }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ArrowDownLeft size={30} />
      </span>
      <h3>Здесь пока тихо</h3>
      <p>{year ? 'В этом году еще нет трат.' : 'В этом месяце еще нет трат.'}</p>
      {onClick && (
        <button className="secondary" onClick={onClick}>
          Добавить первую трату
        </button>
      )}
    </div>
  );
}
function Summary({
  expenses,
  categories,
  total,
  compact = false,
  year,
}: {
  expenses: Expense[];
  categories: Category[];
  total: number;
  compact?: boolean;
  year?: string;
}) {
  const groups = summarize(expenses, categories);
  const { costliestDay, largestExpense } = expenseHighlights(expenses);
  const annual = year ? annualHighlights(expenses, year) : null;
  const dayLabel = (date: string, month: 'long' | 'short' = 'long') =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month }).format(
      new Date(`${date}T12:00:00`),
    );
  return (
    <div className={`summary-content ${compact ? 'compact-summary' : ''}`}>
      <div className="stats-grid">
        <section className="panel stat">
          <span>{year ? 'Всего за год' : 'Всего за месяц'}</span>
          <strong>{money(total)}</strong>
          <small>Все категории · рубли</small>
        </section>
        <section className="panel stat">
          <span>Всего операций</span>
          <strong>{expenses.length.toLocaleString('en-US')}</strong>
          <small>{year ? 'Записей за выбранный год' : 'Записей за выбранный месяц'}</small>
        </section>
        <section className="panel stat">
          <span>Средняя трата</span>
          <strong>{money(expenses.length ? total / expenses.length : 0)}</strong>
          <small>На одну запись</small>
        </section>
        <section className="panel stat stat-insight" aria-label="Самый затратный день">
          <span>Самый затратный день</span>
          <strong
            className={costliestDay && money(costliestDay.total).length > 10 ? 'is-long' : ''}
          >
            {costliestDay ? money(costliestDay.total) : '—'}
          </strong>
          <small>{costliestDay ? dayLabel(costliestDay.date) : 'Нет трат'}</small>
        </section>
        <section className="panel stat stat-insight" aria-label="Самая крупная трата">
          <span>Самая крупная трата</span>
          <strong
            className={
              largestExpense && money(largestExpense.amount_kopecks).length > 10 ? 'is-long' : ''
            }
          >
            {largestExpense ? money(largestExpense.amount_kopecks) : '—'}
          </strong>
          <small>
            {largestExpense
              ? `${categories.find((category) => category.id === largestExpense.category_id)?.name ?? 'Категория'} · ${dayLabel(largestExpense.spent_on, 'short')}`
              : 'Нет трат'}
          </small>
        </section>
        {annual && (
          <>
            <section className="panel stat stat-insight" aria-label="Самый затратный месяц">
              <span>Самый затратный месяц</span>
              <strong
                className={
                  annual.costliestMonth && money(annual.costliestMonth.total).length > 10
                    ? 'is-long'
                    : ''
                }
              >
                {annual.costliestMonth ? money(annual.costliestMonth.total) : '—'}
              </strong>
              <small>
                {annual.costliestMonth
                  ? monthLabel(annual.costliestMonth.month).split(' ')[0]
                  : 'Нет трат'}
              </small>
            </section>
            <section className="panel stat stat-insight" aria-label="Средняя месячная трата">
              <span>Средняя месячная трата</span>
              <strong className={money(annual.monthlyAverage).length > 10 ? 'is-long' : ''}>
                {money(annual.monthlyAverage)}
              </strong>
              <small>{annual.monthCount ? `За ${annual.monthCount} мес.` : 'Нет трат'}</small>
            </section>
          </>
        )}
      </div>
      <section className="panel summary-panel" aria-label="Траты по категориям">
        {!compact && (
          <div className="section-heading">
            <h2>Траты по категориям</h2>
            <span className="pill">{groups.length} категорий</span>
          </div>
        )}
        {!total ? (
          <Empty year={!!year} />
        ) : (
          <div className="category-breakdown">
            {compact && (
              <div className="summary-total">
                <span>{year ? 'Траты года' : 'Траты месяца'}</span>
                <strong>{money(total)}</strong>
              </div>
            )}
            <CategoryTreemap groups={groups} />
            <ol className="category-bars" aria-label="Распределение трат по категориям">
              {groups.map((category) => {
                const percentage = (category.total / total) * 100;
                const percentageText =
                  percentage.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%';
                return (
                  <li className="category-bar-item" key={category.id}>
                    <div className="category-bar-heading">
                      <CategoryIcon category={category} size={20} />
                      <strong className="category-bar-name">{category.name}</strong>
                      <div className="category-bar-values">
                        <b>{money(category.total)}</b>
                        <span>{percentageText}</span>
                      </div>
                    </div>
                    <div
                      className="category-bar-track"
                      role="meter"
                      aria-label={`${category.name}: ${money(category.total)}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                      aria-valuetext={percentageText}
                    >
                      <span
                        className="category-bar-fill"
                        style={{ width: `${percentage}%`, backgroundColor: category.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
