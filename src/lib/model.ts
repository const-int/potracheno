export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
  sort_order?: number | null;
};
export type Expense = {
  id: string;
  user_id: string;
  category_id: string;
  amount_kopecks: number;
  spent_on: string;
  note: string;
  device_name: string;
  created_at: string;
};
export type Data = { categories: Category[]; expenses: Expense[] };
// A complete spectrum arranged from warm tones through cool tones to neutrals.
export const colors = [
  '#d94f5c',
  '#e26754',
  '#de7040',
  '#d98636',
  '#c99a2d',
  '#b3a52e',
  '#8ca33c',
  '#589e52',
  '#38966b',
  '#269b83',
  '#289e9a',
  '#309bb3',
  '#388eac',
  '#3989d4',
  '#4874d4',
  '#5b65cc',
  '#735bd2',
  '#8c55c6',
  '#a452bd',
  '#bc54a6',
  '#cc568b',
  '#d25f78',
  '#da758a',
  '#c8686d',
  '#bd765a',
  '#b48859',
  '#a98d69',
  '#87966a',
  '#a84f66',
  '#ad6045',
  '#996f45',
  '#85715f',
  '#98877b',
  '#868480',
  '#62615f',
  '#d2a34a',
  '#c47c4f',
  '#be527b',
  '#9562a5',
  '#7479a2',
];
export const categoryColorOptions = colors;
export const defaultCategoryColors = [
  colors[7],
  colors[3],
  colors[13],
  colors[0],
  colors[16],
  colors[6],
  colors[9],
  colors[24],
];

export function swatchCheckColor(color: string): string {
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 160 ? '#514164' : '#fff';
}

export function categoryIconColor(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return '#806697';
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  const luminance = (values: number[]) =>
    values.reduce((sum, value, index) => {
      const channel = value / 255;
      return (
        sum +
        (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][index]
      );
    }, 0);
  // Match the translucent category background on the app's lavender surface.
  const background = rgb.map(
    (value, index) => value * (24 / 255) + [247, 245, 249][index] * (1 - 24 / 255),
  );
  let foreground = [...rgb];
  while ((luminance(background) + 0.05) / (luminance(foreground) + 0.05) < 4)
    foreground = foreground.map((value) => Math.floor(value * 0.95));
  return '#' + foreground.map((value) => value.toString(16).padStart(2, '0')).join('');
}
export const categoryIconLabels: Record<string, string> = {
  basket: 'Продукты',
  shop: 'Супермаркет',
  car: 'Тачка',
  heart: 'Здоровье',
  paw: 'Кот',
  home: 'Для дома',
  coffee: 'Кафе',
  other: 'Другое',
  fuel: 'Топливо',
  transport: 'Транспорт',
  food: 'Еда',
  clothes: 'Одежда',
  travel: 'Путешествия',
  study: 'Образование',
  sport: 'Спорт',
  gifts: 'Подарки',
  fun: 'Развлечения',
  bills: 'Счета',
  phone: 'Телефон',
  work: 'Работа',
  star: 'Звезда',
  bike: 'Велосипед',
  lightning: 'Молния',
  puzzle: 'Пазл',
  compass: 'Компас',
  lightbulb: 'Лампочка',
  book: 'Книга',
  palette: 'Палитра',
  tools: 'Инструменты',
  gamepad: 'Геймпад',
  diamond: 'Бриллиант',
  sparkles: 'Искры',
  hexagon: 'Флажок',
  cube: 'Куб',
  clover: 'Клевер',
};
export const categoryIconOptions = [
  'shop',
  'coffee',
  'home',
  'paw',
  'car',
  'clothes',
  'heart',
  'gifts',
  'fun',
  'basket',
  'travel',
  'bills',
  'star',
  'bike',
  'lightning',
  'puzzle',
  'compass',
  'lightbulb',
  'book',
  'palette',
  'tools',
  'gamepad',
  'diamond',
  'sparkles',
  'hexagon',
  'cube',
  'clover',
  'other',
];
export const initialCategories = [
  { name: 'Продукты', icon: 'basket' },
  { name: 'Супермаркеты', icon: 'shop' },
  { name: 'Машина', icon: 'car' },
  { name: 'Здоровье', icon: 'heart' },
  { name: 'Животные', icon: 'paw' },
  { name: 'Дом', icon: 'home' },
  { name: 'Кафе', icon: 'coffee' },
  { name: 'Другое', icon: 'other' },
];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseAmount(value: string): number | null {
  const raw = value.replace(/[\s\u00a0]/g, '');
  const clean = /^[1-9]\d{0,2}(,\d{3})+(\.\d{1,2})?$/.test(raw)
    ? raw.replaceAll(',', '')
    : raw.replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(clean)) return null;
  const [rubles, fraction = ''] = clean.split('.');
  const result = Number(rubles) * 100 + Number(fraction.padEnd(2, '0'));
  return result > 0 && result <= 99_999_999_999 ? result : null;
}
export const money = (kopecks: number) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.ceil(kopecks / 100)) + ' ₽';
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
    .format(new Date(`${month}-01T12:00:00`))
    .replace(' г.', '');
}
export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function summarize(expenses: Expense[], categories: Category[]) {
  return categories
    .map((category) => ({
      ...category,
      total: expenses
        .filter((e) => e.category_id === category.id)
        .reduce((s, e) => s + e.amount_kopecks, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}
export function expenseHighlights(expenses: Expense[]) {
  const days = new Map<string, number>();
  let largestExpense: Expense | null = null;
  for (const expense of expenses) {
    days.set(expense.spent_on, (days.get(expense.spent_on) ?? 0) + expense.amount_kopecks);
    if (
      !largestExpense ||
      expense.amount_kopecks > largestExpense.amount_kopecks ||
      (expense.amount_kopecks === largestExpense.amount_kopecks &&
        expense.spent_on > largestExpense.spent_on)
    )
      largestExpense = expense;
  }
  let costliestDay: { date: string; total: number } | null = null;
  for (const [date, total] of days) {
    if (
      !costliestDay ||
      total > costliestDay.total ||
      (total === costliestDay.total && date > costliestDay.date)
    )
      costliestDay = { date, total };
  }
  return { costliestDay, largestExpense };
}
export function annualHighlights(expenses: Expense[], year: string) {
  const months = new Map<string, number>();
  let total = 0;
  for (const expense of expenses) {
    if (!expense.spent_on.startsWith(`${year}-`)) continue;
    const month = expense.spent_on.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + expense.amount_kopecks);
    total += expense.amount_kopecks;
  }
  let costliestMonth: { month: string; total: number } | null = null;
  for (const [month, total] of months) {
    if (
      !costliestMonth ||
      total > costliestMonth.total ||
      (total === costliestMonth.total && month > costliestMonth.month)
    )
      costliestMonth = { month, total };
  }
  const recordedMonths = [...months.keys()].sort();
  const monthCount = recordedMonths.length
    ? Number(recordedMonths[recordedMonths.length - 1].slice(5, 7)) -
      Number(recordedMonths[0].slice(5, 7)) +
      1
    : 0;
  return { costliestMonth, monthlyAverage: monthCount ? total / monthCount : 0, monthCount };
}
export function csv(data: Data) {
  // Prefix formula-like text so opening the export in a spreadsheet is safe.
  const cell = (v: string) => `"${(/^[\s]*[=+@-]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    [
      ['Дата', 'Сумма, ₽', 'Категория', 'Автор'],
      ...data.expenses.map((e) => [
        e.spent_on,
        (e.amount_kopecks / 100).toFixed(2),
        data.categories.find((c) => c.id === e.category_id)?.name ?? 'Категория',
        e.device_name,
      ]),
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  );
}
export function demoData(): Data {
  const user_id = 'demo';
  const categories = initialCategories.map((c, i) => ({
    ...c,
    id: crypto.randomUUID(),
    user_id,
    color: defaultCategoryColors[i],
    archived: false,
  }));
  const examples = [
    [0, 284050],
    [2, 320000],
    [6, 89000],
    [4, 165000],
    [0, 127000],
    [3, 210000],
    [5, 349000],
    [1, 186050],
    [0, 67000],
  ] as const;
  return {
    categories,
    expenses: examples.map(([c, amount], i) => ({
      id: crypto.randomUUID(),
      user_id,
      category_id: categories[c].id,
      amount_kopecks: amount,
      note: '',
      spent_on:
        today().slice(0, 8) + String(Math.max(1, Number(today().slice(8)) - i)).padStart(2, '0'),
      device_name: i % 2 ? 'Анна' : 'Иван',
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  };
}
