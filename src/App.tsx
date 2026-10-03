import MobileExpenseEntry from './MobileExpenseEntry';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Coffee,
  Download,
  Heart,
  Home,
  LayoutGrid,
  Leaf,
  List,
  LogOut,
  MoreHorizontal,
  PawPrint,
  Pencil,
  Plus,
  Settings,
  ShoppingBasket,
  ShoppingBag,
  UserRound,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  type Category,
  type Data,
  type Expense,
  colors,
  csv,
  money,
  monthLabel,
  parseAmount,
  shiftMonth,
  summarize,
  today,
} from './lib/model';
import {
  deleteExpense,
  errorMessage,
  loadData,
  saveCategory,
  saveExpense,
  seedCategories,
  supabase,
} from './lib/store';

const icons = {
  basket: ShoppingBasket,
  shop: ShoppingBag,
  car: Car,
  heart: Heart,
  paw: PawPrint,
  home: Home,
  coffee: Coffee,
  other: MoreHorizontal,
};
function CategoryIcon({ category, size = 20 }: { category?: Category; size?: number }) {
  const Icon = icons[category?.icon as keyof typeof icons] ?? MoreHorizontal;
  return (
    <span
      className="category-icon"
      style={{
        color: category?.color ?? '#527961',
        backgroundColor: `${category?.color ?? '#527961'}18`,
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
  const [userId, setUserId] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [data, setData] = useState<Data>(empty);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('add');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const changed = () => setIsMobile(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const quickEntry = isMobile && tab === 'add';
  const [month, setMonth] = useState(today().slice(0, 7));
  const [userName, setUserName] = useState(() => localStorage.getItem('vmeste.device') ?? '');
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const session = demo ? 'demo' : userId;
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
          if (error) setNotice(errorMessage(error));
        }
      })
      .catch((e) => {
        if (active) {
          setAuthLoading(false);
          setNotice(errorMessage(e));
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
        if (current === generation.current) {
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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const monthExpenses = data.expenses
    .filter((e) => e.spent_on.startsWith(month))
    .sort(
      (a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at),
    );
  const total = monthExpenses.reduce((sum, e) => sum + e.amount_kopecks, 0);
  const categoryById = (id: string) => data.categories.find((c) => c.id === id);
  const activeCategories = data.categories.filter((c) => !c.archived);
  async function afterSave(text: string) {
    await refresh();
    setNotice(text);
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
      setNotice('Все расходы экспортированы');
    } catch (e) {
      setNotice(errorMessage(e));
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
      setDeleting(null);
      setEditingCategory(null);
      setData(empty);
      setTab('add');
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }

  if (!session)
    return (
      <div className="login-page">
        <div className="login-brand">
          <Brand />
          <span>Семейные финансы, спокойно и понятно.</span>
        </div>
        <div className="login-layout">
          <section className="intro">
            <div className="eyebrow">
              <Leaf size={15} /> ПРОСТО О ВАЖНОМ
            </div>
            <h1>
              Все расходы.
              <br />
              Одна семья.
            </h1>
            <p>
              Покупки, поездки и маленькие радости.
              <br />
              Держите общую картину перед глазами.
            </p>
            <div className="intro-card">
              <span className="intro-symbol">
                <Wallet size={30} />
              </span>
              <div>
                <strong>Больше ясности, меньше подсчетов</strong>
                <p>
                  Добавьте расход за пару секунд —<br />
                  остальное соберется в статистику.
                </p>
              </div>
            </div>
            <div className="intro-bottom">
              <span className="mini-dot" /> Вместе проще планировать завтра.
            </div>
          </section>
          <section className="login-card">
            <div className="eyebrow">ВАШЕ СЕМЕЙНОЕ ПРОСТРАНСТВО</div>
            <h2>{supabase ? 'С возвращением' : 'Давайте начнем'}</h2>
            <p>
              {supabase
                ? 'Войдите в общий аккаунт на каждом устройстве.'
                : 'Интерфейс готов к знакомству. Общую базу подключим следующим шагом.'}
            </p>
            {authLoading ? (
              <p role="status">Проверяем вход…</p>
            ) : supabase ? (
              <Login onError={setNotice} />
            ) : (
              <div className="setup-note">
                <CircleHelp size={20} />
                <span>До подключения базы доступен деморежим с примерами расходов.</span>
              </div>
            )}
            <button
              className={supabase ? 'secondary demo-login' : 'primary demo-login'}
              onClick={() => setDemo(true)}
            >
              Открыть деморежим <ArrowRight size={18} />
            </button>
            <small>
              Демоданные сохраняются только в этом браузере.
              <br />
              Между телефонами они не синхронизируются.
            </small>
          </section>
        </div>
        {notice && (
          <div role="alert" className="toast">
            {notice}
          </div>
        )}
        <footer className="login-footer">Вместе · учет семейных расходов</footer>
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
              ['add', Plus, 'Добавить расход'],
              ['history', List, 'История расходов'],
              ['summary', BarChart3, 'Summary'],
              ['categories', LayoutGrid, 'Категории'],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
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
          <div className="breadcrumb">
            Наша семья <ChevronRight size={13} />{' '}
            <span>
              {
                {
                  add: 'Добавить расход',
                  history: 'История',
                  summary: 'Summary',
                  categories: 'Категории',
                }[tab]
              }
            </span>
          </div>
          <button className="user-pill" onClick={() => setSettings(true)}>
            <UserRound size={15} />
            <span>{userName || 'Указать имя'}</span>
            <span className={`status-dot ${demo ? 'demo-dot' : ''}`} />
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
                      add: 'Каждый расход на своем месте',
                      history: 'История расходов',
                      summary: 'Общая картина',
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
              {loadError ? 'Не удалось загрузить расходы.' : 'Загружаем семейные расходы…'}
            </div>
          ) : (
            <>
              {quickEntry && (
                <MobileExpenseEntry
                  categories={activeCategories}
                  userId={session!}
                  userName={userName}
                  demo={demo}
                  renderCategoryIcon={(category) => <CategoryIcon category={category} size={19} />}
                  onSave={() => afterSave('Расход сохранен')}
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
                        Новый расход
                      </h2>
                      <span className="pill">₽ RUB</span>
                    </div>
                    <ExpenseForm
                      categories={activeCategories}
                      userId={session!}
                      demo={demo}
                      userName={userName}
                      onSave={() => afterSave('Расход сохранен')}
                      onName={() => setSettings(true)}
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
                      <span>Общие расходы семьи</span>
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
                              <span>{e.note || e.device_name}</span>
                            </div>
                            <b>{money(e.amount_kopecks)}</b>
                          </div>
                        ))}
                      {!data.expenses.length && (
                        <p className="muted">Здесь появятся ваши первые расходы.</p>
                      )}
                    </section>
                    <div className="help-note">
                      <Check size={17} />
                      <p>
                        {demo
                          ? 'Можно попробовать всё: добавление, категории и статистику.'
                          : 'Расходы доступны на обоих телефонах. Список обновляется каждые 30 секунд и при возвращении в приложение.'}
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              {(tab === 'history' || tab === 'summary') && (
                <>
                  <div className="period-row">
                    <div className="month-switch">
                      <button
                        onClick={() => setMonth(shiftMonth(month, -1))}
                        aria-label="Предыдущий месяц"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <span>{monthLabel(month)}</span>
                      <button
                        onClick={() => setMonth(shiftMonth(month, 1))}
                        aria-label="Следующий месяц"
                      >
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    {!isMobile && <span className="muted">{monthExpenses.length} записей</span>}
                    {isMobile && tab === 'history' && (
                      <strong className="period-total">{money(total)}</strong>
                    )}
                  </div>
                  {tab === 'summary' ? (
                    <Summary
                      expenses={monthExpenses}
                      categories={data.categories}
                      total={total}
                      compact={isMobile}
                    />
                  ) : (
                    <section className="panel history-panel" aria-label="История расходов">
                      {!isMobile && (
                        <div className="section-heading">
                          <h2>Расходы за месяц</h2>
                          <strong className="history-total">{money(total)}</strong>
                        </div>
                      )}
                      {!monthExpenses.length && <Empty onClick={() => setTab('add')} />}
                      <div className="expense-list">
                        {monthExpenses.map((e) => (
                          <div className="expense-row" key={e.id}>
                            <CategoryIcon category={categoryById(e.category_id)} />
                            <div className="expense-info">
                              <strong>
                                {categoryById(e.category_id)?.name ?? 'Категория'}
                                {categoryById(e.category_id)?.archived && (
                                  <span className="archived-tag">архив</span>
                                )}
                              </strong>
                              {e.note ? <p>{e.note}</p> : !isMobile && <p>Без комментария</p>}
                              <span>
                                {new Intl.DateTimeFormat('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                }).format(new Date(e.spent_on + 'T12:00:00'))}{' '}
                                · {e.device_name}
                              </span>
                            </div>
                            <b>{money(e.amount_kopecks)}</b>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Редактировать ${e.note || categoryById(e.category_id)?.name}`}
                                onClick={() => setEditing(e)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Удалить ${e.note || categoryById(e.category_id)?.name}`}
                                onClick={() => {
                                  setActionError('');
                                  setDeleting(e);
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              {tab === 'categories' && (
                <section className="panel categories-panel">
                  <div className="section-heading">
                    {!isMobile && <h2>Категории расходов</h2>}
                    <button className="primary compact" onClick={() => setEditingCategory('new')}>
                      <Plus size={17} />
                      Добавить
                    </button>
                  </div>
                  {!isMobile && (
                    <p className="muted">Архивные категории сохраняются в истории и статистике.</p>
                  )}
                  <div className="category-list">
                    {data.categories.map((c) => (
                      <button
                        className="category-manage"
                        key={c.id}
                        onClick={() => setEditingCategory(c)}
                      >
                        <CategoryIcon category={c} />
                        <div>
                          <strong>{c.name}</strong>
                          <span>
                            {c.archived
                              ? 'В архиве'
                              : `${data.expenses.filter((e) => e.category_id === c.id).length} записей`}
                          </span>
                        </div>
                        <Pencil size={16} />
                      </button>
                    ))}
                  </div>
                  {!data.categories.length && (
                    <SeedButton userId={session!} demo={demo} onSave={() => refresh()} />
                  )}
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
            ['add', Plus, 'Расход'],
            ['history', List, 'История'],
            ['summary', BarChart3, 'Summary'],
            ['categories', LayoutGrid, 'Категории'],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {editing && (
        <Modal title="Редактировать расход" close={() => setEditing(null)}>
          <ExpenseForm
            categories={data.categories.filter((c) => !c.archived || c.id === editing.category_id)}
            userId={session!}
            demo={demo}
            userName={userName}
            existing={editing}
            onName={() => setSettings(true)}
            onSave={async () => {
              setEditing(null);
              await afterSave('Расход обновлен');
            }}
          />
        </Modal>
      )}
      {editingCategory && (
        <Modal
          title={editingCategory === 'new' ? 'Новая категория' : 'Изменить категорию'}
          close={() => setEditingCategory(null)}
        >
          <CategoryForm
            userId={session!}
            demo={demo}
            existing={editingCategory === 'new' ? undefined : editingCategory}
            onSave={async () => {
              setEditingCategory(null);
              await afterSave('Категория сохранена');
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Удалить расход?"
          close={() => {
            if (!deleteBusy) setDeleting(null);
          }}
        >
          <p className="muted">
            {money(deleting.amount_kopecks)} · {categoryById(deleting.category_id)?.name}. Удаленную
            запись нельзя восстановить.
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <div className="modal-actions">
            <button className="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Отмена
            </button>
            <button
              className="danger"
              disabled={deleteBusy}
              onClick={async () => {
                setDeleteBusy(true);
                setActionError('');
                try {
                  await deleteExpense(demo, deleting.id);
                  setDeleting(null);
                  await afterSave('Расход удален');
                } catch (e) {
                  setActionError(errorMessage(e));
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? 'Удаляем…' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="Настройки" close={() => setSettings(false)}>
          <UserSettings
            userName={userName}
            onSave={(name) => {
              localStorage.setItem('vmeste.device', name);
              setUserName(name);
              setSettings(false);
              setNotice('Имя пользователя сохранено');
            }}
          />
          <div className="settings-separator" />
          <button className="secondary full-width" onClick={exportData} disabled={exportBusy}>
            <Download size={17} />
            {exportBusy ? 'Экспорт…' : 'Экспортировать все расходы в CSV'}
          </button>
          <button className="text-button logout-button" onClick={logout}>
            <LogOut size={17} />
            {demo ? 'Выйти из деморежима' : 'Выйти на этом устройстве'}
          </button>
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
      вместе<span className="brand-period">.</span>
    </div>
  );
}
function Login({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email: String(values.get('email')).trim(),
        password: String(values.get('password')),
      });
      if (error) throw error;
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
  onName,
}: {
  categories: Category[];
  userId: string;
  demo: boolean;
  userName: string;
  existing?: Expense;
  onSave: () => Promise<void>;
  onName: () => void;
}) {
  const [amount, setAmount] = useState(
    existing ? String(existing.amount_kopecks / 100).replace('.', ',') : '',
  );
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '');
  const [date, setDate] = useState(existing?.spent_on ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setError('');
    const kopecks = parseAmount(amount);
    if (kopecks === null) {
      setError('Укажите сумму больше нуля, до 999 999 999,99 ₽, с точностью до копеек.');
      return;
    }
    if (!categories.some((c) => c.id === categoryId)) {
      setError('Выберите категорию.');
      return;
    }
    if (!userName && !existing) {
      setError('Укажите свое имя, чтобы видеть, кто добавил расход.');
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
          note: note.trim(),
          device_name: existing?.device_name ?? userName,
          created_at: existing?.created_at ?? new Date().toISOString(),
        },
        !!existing,
      );
      if (!existing) {
        setAmount('');
        setNote('');
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
    <form className="expense-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <label className="amount-label" htmlFor="amount">
          Сумма расхода
        </label>
        <div className="amount-input">
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label="Сумма расхода"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
              <CategoryIcon category={c} size={22} />
              <span>{c.name}</span>
              {categoryId === c.id && <Check className="category-check" size={13} />}
            </button>
          ))}
        </div>
        {!categories.length && (
          <p className="form-error">Сначала добавьте категории на вкладке «Категории».</p>
        )}
        <label>
          Дата расхода
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
        <label>
          Комментарий <span className="optional">необязательно</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например, продукты на неделю"
            maxLength={500}
          />
        </label>
        <div className="form-author">
          <UserRound size={15} />
          {existing?.device_name || userName || 'Имя пока не указано'}
          {!existing && (
            <button type="button" onClick={onName}>
              {userName ? 'Изменить' : 'Указать'}
            </button>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full-width save-expense" disabled={busy || !categories.length}>
          <Plus size={19} />
          {busy ? 'Сохраняем…' : existing ? 'Сохранить изменения' : 'Добавить расход'}
        </button>
      </fieldset>
    </form>
  );
}
function CategoryForm({
  existing,
  userId,
  demo,
  onSave,
}: {
  existing?: Category;
  userId: string;
  demo: boolean;
  onSave: () => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? colors[0]);
  const [icon, setIcon] = useState(existing?.icon ?? 'other');
  const [archived, setArchived] = useState(existing?.archived ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
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
              archived,
            },
            !!existing,
          );
          await onSave();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
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
          {colors.map((c) => (
            <button
              type="button"
              key={c}
              style={{ background: c }}
              className={c === color ? 'selected' : ''}
              aria-label={`Цвет ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            >
              {c === color && <Check size={18} />}
            </button>
          ))}
        </div>
        <div className="field-heading">Значок</div>
        <div className="icon-picker">
          {Object.entries(icons).map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setIcon(id)}
              aria-label={`Значок ${id}`}
              aria-pressed={icon === id}
              className={icon === id ? 'selected' : ''}
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
        {existing && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Убрать категорию в архив
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full-width" disabled={busy || !name.trim()}>
          {busy ? 'Сохраняем…' : 'Сохранить категорию'}
        </button>
      </fieldset>
    </form>
  );
}
function UserSettings({ userName, onSave }: { userName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(userName);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <p className="muted">
        Имя видно рядом с добавленными расходами. Каждый из вас указывает свое имя в своем браузере.
      </p>
      <label>
        Имя пользователя
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          placeholder="Например, Анна"
        />
      </label>
      <button className="primary full-width" disabled={!name.trim()}>
        Сохранить имя
      </button>
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
function Empty({ onClick }: { onClick?: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ArrowDownLeft size={30} />
      </span>
      <h3>Здесь пока тихо</h3>
      <p>В этом месяце еще нет расходов.</p>
      {onClick && (
        <button className="secondary" onClick={onClick}>
          Добавить первый расход
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
}: {
  expenses: Expense[];
  categories: Category[];
  total: number;
  compact?: boolean;
}) {
  const groups = summarize(expenses, categories);
  let offset = 0;
  return (
    <div className={`summary-content ${compact ? 'compact-summary' : ''}`}>
      <div className="stats-grid">
        <section className="panel stat">
          <span>Всего за месяц</span>
          <strong>{money(total)}</strong>
          <small>Все категории · рубли</small>
        </section>
        <section className="panel stat">
          <span>Количество расходов</span>
          <strong>{expenses.length}</strong>
          <small>Записей за выбранный месяц</small>
        </section>
        <section className="panel stat">
          <span>Средний расход</span>
          <strong>{money(expenses.length ? Math.round(total / expenses.length) : 0)}</strong>
          <small>На одну запись</small>
        </section>
      </div>
      <section className="panel summary-panel" aria-label="Расходы по категориям">
        {!compact && (
          <div className="section-heading">
            <h2>Расходы по категориям</h2>
            <span className="pill">{groups.length} категорий</span>
          </div>
        )}
        {!total ? (
          <Empty />
        ) : (
          <div className="chart-layout">
            <div className="donut-wrap">
              <svg
                viewBox="0 0 240 240"
                role="img"
                aria-label="Распределение расходов по категориям. Суммы и доли приведены в списке рядом."
              >
                <circle cx="120" cy="120" r="88" fill="none" stroke="#eceee8" strokeWidth="27" />
                {groups.map((c) => {
                  const percentage = (c.total / total) * 100;
                  const start = offset;
                  offset += percentage;
                  return (
                    <circle
                      key={c.id}
                      cx="120"
                      cy="120"
                      r="88"
                      fill="none"
                      stroke={c.color}
                      strokeWidth="27"
                      pathLength="100"
                      strokeDasharray={`${percentage} ${100 - percentage}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 120 120)"
                    >
                      <title>
                        {c.name}: {money(c.total)} ({percentage.toFixed(1)}%)
                      </title>
                    </circle>
                  );
                })}
              </svg>
              <div className="donut-center">
                <span>Расходы месяца</span>
                <strong>{money(total)}</strong>
                <small>Всё под контролем</small>
              </div>
            </div>
            <div className="legend">
              {groups.map((c) => (
                <div className="legend-item" key={c.id}>
                  <div className="legend-top">
                    <span className="legend-dot" style={{ background: c.color }} />
                    <strong>{c.name}</strong>
                    <b>{money(c.total)}</b>
                  </div>
                  <div className="legend-bottom">
                    <div className="progress">
                      <span style={{ width: `${(c.total / total) * 100}%`, background: c.color }} />
                    </div>
                    <span>
                      {((c.total / total) * 100).toLocaleString('ru-RU', {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
