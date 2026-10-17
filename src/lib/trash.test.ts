import { afterEach, expect, it, vi } from 'vitest';
import {
  csv,
  isRestorable,
  partitionExpenses,
  trashRetentionMs,
  type Data,
  type Expense,
} from './model';
import {
  deleteCategory,
  deleteExpense,
  importExpenses,
  loadData,
  readDemo,
  restoreExpense,
} from './store';
const now = new Date('2026-10-17T10:00:00Z');
const expense: Expense = {
  id: 'one',
  user_id: 'demo',
  category_id: 'food',
  amount_kopecks: 123456,
  spent_on: '2026-09-02',
  created_at: '2026-09-02T17:21:00Z',
  note: 'Комментарий',
  device_name: 'Автор',
};
const data: Data = {
  categories: [
    { id: 'food', user_id: 'demo', name: 'Еда', icon: 'food', color: '#589e52', archived: false },
  ],
  expenses: [expense],
};
function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const storage = new Map([['vmeste.demo.v1', JSON.stringify(data)]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps deleted expenses separate and excludes them from CSV, with an exact 30-day boundary', () => {
  const deleted = { ...expense, deleted_at: now.toISOString() };
  expect(isRestorable(deleted, now.getTime() + trashRetentionMs - 1)).toBe(true);
  expect(isRestorable(deleted, now.getTime() + trashRetentionMs)).toBe(false);
  expect(isRestorable(deleted, now.getTime() + trashRetentionMs + 1)).toBe(false);
  const separated = partitionExpenses({ ...data, expenses: [expense, deleted] }, now.getTime());
  expect(separated.expenses).toEqual([expense]);
  expect(separated.deletedExpenses).toEqual([deleted]);
  expect(csv({ ...data, expenses: [deleted] })).not.toContain('Комментарий"\r\n');
  expect(csv({ ...data, expenses: [deleted] }).split('\r\n')).toHaveLength(1);
});
it('demo deletion and restore preserve every field and prevent deleting the retained category', async () => {
  setup();
  await deleteExpense(true, expense.id);
  expect((await loadData(true)).expenses).toEqual([]);
  expect((await loadData(true)).deletedExpenses).toEqual([
    { ...expense, deleted_at: now.toISOString() },
  ]);
  await expect(deleteCategory(true, 'food')).rejects.toThrow('корзине');
  await restoreExpense(true, expense.id);
  expect((await loadData(true)).expenses).toEqual([{ ...expense, deleted_at: null }]);
  expect((await loadData(true)).deletedExpenses).toEqual([]);
});
it('demo cleanup removes expired trash and refuses restoration after the deadline', async () => {
  setup();
  await deleteExpense(true, expense.id);
  vi.setSystemTime(now.getTime() + trashRetentionMs);
  expect((await loadData(true)).deletedExpenses).toEqual([]);
  expect(readDemo().expenses).toEqual([]);
  await expect(restoreExpense(true, expense.id)).rejects.toThrow('истёк');
  await deleteCategory(true, 'food');
  expect(readDemo().categories).toEqual([]);
});
it('CSV import preserves demo trash and does not resurrect the same purchase on reimport', async () => {
  setup();
  await deleteExpense(true, expense.id);
  const rows = [
    {
      id: 'import-one',
      date: expense.spent_on,
      amount: expense.amount_kopecks,
      category: 'Еда',
      author: expense.device_name,
      note: expense.note,
    },
  ];
  expect(await importExpenses(true, 'demo', rows, true)).toEqual({ imported: 0, skipped: 1 });
  expect(
    await importExpenses(true, 'demo', [{ ...rows[0], id: 'new', amount: 50000 }], true),
  ).toEqual({ imported: 1, skipped: 0 });
  expect((await loadData(true)).deletedExpenses).toHaveLength(1);
  expect((await loadData(true)).expenses).toHaveLength(1);
});
