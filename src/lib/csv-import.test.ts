import { afterEach, describe, expect, it, vi } from 'vitest';
import { csv, type Category, type Data, type Expense } from './model';
import { parseImport, planImport } from './csv-import';
import { importExpenses } from './store';

const category: Category = {
  id: 'food',
  user_id: 'demo',
  name: 'Продукты',
  color: '#527961',
  icon: 'basket',
  archived: true,
};
const expense: Expense = {
  id: 'original',
  user_id: 'demo',
  category_id: 'food',
  amount_kopecks: 123450,
  spent_on: '2024-02-29',
  note: '=A1\nHe said "hello"; twice',
  device_name: '+Анна "тест"\nвторая строка',
  created_at: '2024-02-29T12:00:00Z',
};
const data: Data = { categories: [category], expenses: [expense] };
afterEach(() => vi.unstubAllGlobals());

describe('CSV import', () => {
  it('round-trips our export, including quoted multiline text, kopecks and escaped formula-like text', () => {
    const result = parseImport(csv(data), 'Иван');
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      date: expense.spent_on,
      amount: expense.amount_kopecks,
      category: category.name,
      author: expense.device_name,
    });
    expect(result.rows[0]).not.toHaveProperty('note');
    expect(planImport(result.rows, data).skipped).toBe(1);
  });
  it('reads Russian Excel-style dates and optional fields', () => {
    const result = parseImport(
      '\uFEFFДата;Сумма;Категория\r\n29.02.2024;1500;Продукты\r\n',
      'Анна',
    );
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      date: '2024-02-29',
      amount: 150000,
      author: 'Анна',
    });
  });
  it('reads comma-delimited English headers and grouped amounts in quoted cells', () => {
    const result = parseImport(
      'Date,Amount (RUB),Category,Comment,Device\n2024-02-29,"1,234.50",Food,"A, B",Phone',
      'Анна',
    );
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ amount: 123450, author: 'Phone' });
  });
  it('reports impossible dates, zero amounts and missing categories with row numbers', () => {
    const result = parseImport(
      'Дата;Сумма;Категория\n2024-02-30;1;Дом\n2024-02-29;0;Дом\n2024-02-29;1;',
      'Анна',
    );
    expect(result.rows).toHaveLength(0);
    expect(result.issues.map((issue) => issue.row)).toEqual([2, 3, 4]);
    expect(
      parseImport('Date;Amount;Category\n2024-01-01;1;Home;Extra', 'Анна').issues[0].message,
    ).toContain('лишние колонки');
    expect(parseImport('Date;Category\n2024-01-01;Home', 'Анна').issues[0].message).toContain(
      'Сумма',
    );
    expect(
      parseImport('Date;Дата;Amount;Category\n2024-01-01;2024-01-01;1;Home', 'Анна').issues,
    ).toHaveLength(1);
  });
  it('preserves legitimate identical purchases and skips existing ones by count', () => {
    const original = parseImport(csv(data), 'Иван').rows[0];
    const rows = [original, { ...original, id: 'second' }, { ...original, id: 'third' }];
    const plan = planImport(rows, data);
    expect(plan.rows).toHaveLength(2);
    expect(plan.skipped).toBe(1);
    expect(planImport(rows, data, false).rows).toHaveLength(3);
  });
  it('adds new categories once, reuses archived categories and makes retries safe in demo storage', async () => {
    const storage = new Map<string, string>([['vmeste.demo.v1', JSON.stringify(data)]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const parsed = parseImport(
      'Дата;Сумма;Категория;Автор\n2024-03-01;100;Путешествия;Анна\n2024-03-02;200;путешествия;Анна\n2024-03-03;300;продукты;Анна',
      'Иван',
    );
    expect(parsed.issues).toEqual([]);
    expect(await importExpenses(true, 'demo', parsed.rows, true)).toEqual({
      imported: 3,
      skipped: 0,
    });
    const saved: Data = JSON.parse(storage.get('vmeste.demo.v1')!);
    expect(saved.categories).toHaveLength(2);
    expect(saved.expenses).toHaveLength(4);
    expect(saved.categories.find((c) => c.id === 'food')?.archived).toBe(true);
    expect(await importExpenses(true, 'demo', parsed.rows, false)).toEqual({
      imported: 0,
      skipped: 3,
    });
    const fresh = parseImport(
      'Дата;Сумма;Категория;Автор\n2024-03-01;100;Путешествия;Анна\n2024-03-02;200;путешествия;Анна\n2024-03-03;300;продукты;Анна',
      'Иван',
    );
    expect(planImport(fresh.rows, JSON.parse(storage.get('vmeste.demo.v1')!)).skipped).toBe(3);
  });
});
