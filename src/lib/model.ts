export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
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
export const colors = [
  '#527961',
  '#dba765',
  '#879bbe',
  '#c27f70',
  '#a79bb9',
  '#87947a',
  '#6ba4a4',
  '#c994aa',
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
    minimumFractionDigits: kopecks % 100 ? 2 : 0,
    maximumFractionDigits: kopecks % 100 ? 2 : 0,
  }).format(kopecks / 100) + ' ₽';
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
export function csv(data: Data) {
  // Prefix formula-like text so opening the export in a spreadsheet is safe.
  const cell = (v: string) => `"${(/^[\s]*[=+@-]/.test(v) ? "'" + v : v).replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    [
      ['Дата', 'Сумма, ₽', 'Категория', 'Комментарий', 'Автор'],
      ...data.expenses.map((e) => [
        e.spent_on,
        (e.amount_kopecks / 100).toFixed(2),
        data.categories.find((c) => c.id === e.category_id)?.name ?? 'Категория',
        e.note,
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
    color: colors[i],
    archived: false,
  }));
  const examples = [
    [0, 284050, 'Продукты на неделю'],
    [2, 320000, 'Заправка'],
    [6, 89000, 'Завтрак вдвоем'],
    [4, 165000, 'Корм'],
    [0, 127000, 'Овощи и фрукты'],
    [3, 210000, 'Аптека'],
    [5, 349000, 'Для дома'],
    [1, 186050, 'Покупки в супермаркете'],
    [0, 67000, 'К ужину'],
  ] as const;
  return {
    categories,
    expenses: examples.map(([c, amount, note], i) => ({
      id: crypto.randomUUID(),
      user_id,
      category_id: categories[c].id,
      amount_kopecks: amount,
      note,
      spent_on:
        today().slice(0, 8) + String(Math.max(1, Number(today().slice(8)) - i)).padStart(2, '0'),
      device_name: i % 2 ? 'Анна' : 'Иван',
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  };
}
