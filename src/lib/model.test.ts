import { describe, expect, it } from 'vitest';
import {
  money,
  categoryIconColor,
  expenseHighlights,
  annualHighlights,
  csv,
  parseAmount,
  shiftMonth,
  summarize,
  type Category,
  type Expense,
} from './model';

describe('amounts stored as integer kopecks', () => {
  it('parses comma, dot and grouped rubles without float arithmetic', () => {
    expect(parseAmount('1 234,56')).toBe(123456);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('1,000,000')).toBe(100000000);
    expect(parseAmount('0.29')).toBe(29);
    expect(parseAmount('12,5')).toBe(1250);
    expect(parseAmount('999999999.99')).toBe(99999999999);
  });
  it('rejects zero, negative, excessive precision and invalid input', () => {
    for (const value of ['0', '0,00', '-5', '1.234', '1e6', 'NaN', '', '1000000000', '1,2,3'])
      expect(parseAmount(value)).toBeNull();
  });
});
it('moves across year boundaries and leap-year February', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2024-01', 1)).toBe('2024-02');
});
const categories: Category[] = [
  { id: 'food', name: 'Продукты', color: '#527961', icon: 'basket', archived: false, user_id: 'u' },
  { id: 'pets', name: 'Животные', color: '#879bbe', icon: 'paw', archived: true, user_id: 'u' },
];
const expense = (category_id: string, amount_kopecks: number): Expense => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  category_id,
  amount_kopecks,
  spent_on: '2026-02-28',
  created_at: '2026-02-28T00:00:00Z',
  note: '',
  device_name: 'Телефон',
});
it('includes archived categories in totals and sorts by amount', () => {
  const summary = summarize(
    [expense('food', 29), expense('food', 1), expense('pets', 50)],
    categories,
  );
  expect(summary.map((c) => [c.id, c.total])).toEqual([
    ['pets', 50],
    ['food', 30],
  ]);
  expect(summarize([], categories)).toEqual([]);
});
it('exports exact kopecks and escapes quotes, newlines and spreadsheet formulas', () => {
  const e = {
    ...expense('food', 129),
    note: 'Скрытая старая заметка',
    device_name: '+Телефон "тест"\nновая строка',
  };
  const result = csv({ expenses: [e], categories });
  expect(result.startsWith('\uFEFF')).toBe(true);
  expect(result).toContain('"1.29"');
  expect(result).not.toContain('Скрытая старая заметка');
  expect(result).not.toContain('Комментарий');
  expect(result).toContain('"\'+Телефон ""тест""\nновая строка"');
});

it('displays only whole rubles, rounding any fraction upwards without changing stored amounts', () => {
  expect(money(0)).toBe('0 ₽');
  expect(money(1)).toBe('1 ₽');
  expect(money(100)).toBe('1 ₽');
  expect(money(101)).toBe('2 ₽');
  expect(money(199)).toBe('2 ₽');
  expect(money(19888984)).toBe('198,890 ₽');
  expect(money(100.001)).toBe('2 ₽');
});

it('keeps dark category colors and darkens light icon strokes without changing their hue family', () => {
  expect(categoryIconColor('#3f6f93')).toBe('#3f6f93');
  const pale = '#bda7ed';
  const adjusted = categoryIconColor(pale);
  expect(adjusted).not.toBe(pale);
  const channels = [1, 3, 5].map((index) => parseInt(adjusted.slice(index, index + 2), 16));
  expect(channels[2]).toBeGreaterThan(channels[0]);
  expect(channels[0]).toBeGreaterThan(channels[1]);
  expect(pale).toBe('#bda7ed');
});

it('finds the largest daily sum separately from the largest individual expense', () => {
  const expenses = [
    { ...expense('food', 100001), spent_on: '2026-02-01' },
    { ...expense('food', 100000), spent_on: '2026-02-01' },
    { ...expense('pets', 150000), spent_on: '2026-02-02' },
  ];
  const result = expenseHighlights(expenses);
  expect(result.costliestDay).toEqual({ date: '2026-02-01', total: 200001 });
  expect(result.largestExpense).toEqual(expenses[2]);
  expect(expenseHighlights([])).toEqual({ costliestDay: null, largestExpense: null });
  const tied = expenseHighlights([
    { ...expense('food', 100), spent_on: '2026-02-01' },
    { ...expense('food', 100), spent_on: '2026-02-02' },
  ]);
  expect(tied.costliestDay?.date).toBe('2026-02-02');
});

it('annual averages include gaps between recorded months but exclude empty months at both ends', () => {
  const expense = (date: string, amount: number) =>
    ({ spent_on: date, amount_kopecks: amount }) as Expense;
  const expenses = [
    expense('2026-04-01', 20000),
    expense('2026-10-01', 30000),
    expense('2026-10-02', 20000),
    expense('2025-03-01', 900000),
  ];
  expect(annualHighlights(expenses, '2026')).toEqual({
    costliestMonth: { month: '2026-10', total: 50000 },
    monthlyAverage: 10000,
    monthCount: 7,
  });
  expect(annualHighlights(expenses, '2025')).toEqual({
    costliestMonth: { month: '2025-03', total: 900000 },
    monthlyAverage: 900000,
    monthCount: 1,
  });
  expect(annualHighlights([], '2026')).toEqual({
    costliestMonth: null,
    monthlyAverage: 0,
    monthCount: 0,
  });
  expect(
    annualHighlights([expense('2024-01-01', 100), expense('2024-12-31', 200)], '2024').monthCount,
  ).toBe(12);
});
