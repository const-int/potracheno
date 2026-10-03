import { describe, expect, it } from 'vitest';
import { csv, parseAmount, shiftMonth, summarize, type Category, type Expense } from './model';

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
