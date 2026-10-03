import { createClient } from '@supabase/supabase-js';
import { categoryKey, planImport, type ImportRow } from './csv-import';
import {
  type Category,
  type Expense,
  type Data,
  demoData,
  initialCategories,
  colors,
} from './model';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
const demoKey = 'vmeste.demo.v1';
export function readDemo(): Data {
  try {
    const saved = localStorage.getItem(demoKey);
    if (saved) return JSON.parse(saved);
  } catch {
    /* Reset invalid demo storage. */
  }
  const data = demoData();
  localStorage.setItem(demoKey, JSON.stringify(data));
  return data;
}
async function allRows<T>(table: string): Promise<T[]> {
  if (!supabase) throw new Error('База не подключена.');
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + 499);
    if (error) throw error;
    result.push(...(data as T[]));
    if (data.length < 500) return result;
  }
}
export async function loadData(demo: boolean): Promise<Data> {
  if (demo) return readDemo();
  const [categories, expenses] = await Promise.all([
    allRows<Category>('categories'),
    allRows<Expense>('expenses'),
  ]);
  return { categories, expenses };
}
export async function saveExpense(demo: boolean, expense: Expense, editing: boolean) {
  if (demo) {
    const data = readDemo();
    data.expenses = editing
      ? data.expenses.map((e) => (e.id === expense.id ? expense : e))
      : [expense, ...data.expenses];
    localStorage.setItem(demoKey, JSON.stringify(data));
    return;
  }
  const { error } = editing
    ? await supabase!
        .from('expenses')
        .update({
          amount_kopecks: expense.amount_kopecks,
          category_id: expense.category_id,
          spent_on: expense.spent_on,
        })
        .eq('id', expense.id)
        .select()
        .single()
    : await supabase!.from('expenses').insert(expense);
  if (error) throw error;
}
export async function deleteExpense(demo: boolean, id: string) {
  if (demo) {
    const data = readDemo();
    data.expenses = data.expenses.filter((e) => e.id !== id);
    localStorage.setItem(demoKey, JSON.stringify(data));
    return;
  }
  const { error } = await supabase!.from('expenses').delete().eq('id', id).select().single();
  if (error) throw error;
}
export async function saveCategory(demo: boolean, category: Category, editing: boolean) {
  if (demo) {
    const data = readDemo();
    if (
      data.categories.some(
        (c) =>
          c.id !== category.id &&
          c.name.toLocaleLowerCase('ru') === category.name.toLocaleLowerCase('ru'),
      )
    )
      throw new Error('Категория с таким названием уже есть.');
    data.categories = editing
      ? data.categories.map((c) => (c.id === category.id ? category : c))
      : [...data.categories, category];
    localStorage.setItem(demoKey, JSON.stringify(data));
    return;
  }
  const { error } = editing
    ? await supabase!
        .from('categories')
        .update({
          name: category.name,
          color: category.color,
          icon: category.icon,
          archived: category.archived,
        })
        .eq('id', category.id)
        .select()
        .single()
    : await supabase!.from('categories').insert(category);
  if (error) throw error;
}
export async function seedCategories(user_id: string) {
  const { error } = await supabase!.from('categories').upsert(
    initialCategories.map((c, i) => ({ ...c, user_id, color: colors[i] })),
    { onConflict: 'user_id,name', ignoreDuplicates: true },
  );
  if (error) throw error;
}
export async function importExpenses(
  demo: boolean,
  userId: string,
  rows: ImportRow[],
  skipDuplicates: boolean,
) {
  const data = await loadData(demo);
  const plan = planImport(rows, data, skipDuplicates);
  if (!plan.rows.length) return { imported: 0, skipped: plan.skipped };
  const newCategories: Category[] = plan.newCategories.map((name, index) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    name,
    color: colors[(data.categories.length + index) % colors.length],
    icon: 'other',
    archived: false,
  }));
  let categories = [...data.categories, ...newCategories];
  if (!demo && newCategories.length) {
    const { error } = await supabase!
      .from('categories')
      .upsert(newCategories, { onConflict: 'user_id,name', ignoreDuplicates: true });
    if (error && error.code !== '23505') throw error;
    categories = await allRows<Category>('categories');
  }
  const byName = new Map(categories.map((category) => [categoryKey(category.name), category.id]));
  const createdAt = new Date().toISOString();
  const expenses: Expense[] = plan.rows.map((row) => {
    const categoryId = byName.get(categoryKey(row.category));
    if (!categoryId) throw new Error('Не удалось создать категории. Повторите импорт.');
    return {
      id: row.id,
      user_id: userId,
      category_id: categoryId,
      amount_kopecks: row.amount,
      spent_on: row.date,
      note: '',
      device_name: row.author,
      created_at: createdAt,
    };
  });
  if (demo) {
    localStorage.setItem(
      demoKey,
      JSON.stringify({ categories, expenses: [...expenses, ...data.expenses] }),
    );
  } else {
    // One request keeps expense insertion transactional. Stable row IDs make retries safe.
    const { error } = await supabase!
      .from('expenses')
      .upsert(expenses, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
  }
  return { imported: expenses.length, skipped: plan.skipped };
}
export function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : ((error as { message?: string })?.message ?? '');
  if (message.includes('Invalid login credentials')) return 'Проверьте email и пароль.';
  if (message.includes('23505') || message.includes('duplicate key'))
    return 'Категория с таким названием уже есть.';
  if (/fetch|network/i.test(message))
    return 'Не удалось связаться с сервером. Проверьте подключение к интернету.';
  return message || 'Не удалось выполнить действие. Попробуйте еще раз.';
}
