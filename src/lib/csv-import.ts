import Papa from 'papaparse';
import { type Data, parseAmount } from './model';

export type ImportRow = {
  id: string;
  date: string;
  amount: number;
  category: string;
  author: string;
};
export type ImportIssue = { row: number; message: string };
export type ParsedImport = { rows: ImportRow[]; issues: ImportIssue[] };
export const maxImportRows = 5000;
export const categoryKey = (name: string) => name.trim().toLocaleLowerCase('ru');
const normalizeHeader = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/[\s_,().₽:]+/g, ' ')
    .trim();
const aliases = {
  date: ['дата', 'дата расхода', 'date', 'spent on', 'expense date'],
  amount: [
    'сумма',
    'сумма руб',
    'сумма rub',
    'amount',
    'amount rub',
    'amount rubles',
    'expense amount',
  ],
  category: ['категория', 'категория расхода', 'category'],
  author: [
    'автор',
    'устройство',
    'имя пользователя',
    'author',
    'device',
    'user',
    'user name',
    'username',
  ],
};
function dateValue(value: string) {
  let clean = value.trim();
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(clean);
  if (dotted) clean = `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || clean < '1900-01-01' || clean > '2100-12-31')
    return null;
  const date = new Date(clean + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== clean ? null : clean;
}
// Undo the spreadsheet-formula escaping used by our CSV exporter.
const textValue = (value: string) => (/^'[\s]*[=+@-]/.test(value) ? value.slice(1) : value);

export function parseImport(source: string, defaultAuthor: string): ParsedImport {
  const parsed = Papa.parse<string[]>(source.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
    delimitersToGuess: [';', ',', '\t'],
  });
  const issues: ImportIssue[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 1,
    message: 'Не удалось прочитать CSV. Проверьте разделители и кавычки.',
  }));
  const [header, ...records] = parsed.data;
  if (!header?.length || !records.length)
    return {
      rows: [],
      issues: [{ row: 1, message: 'В файле должны быть заголовки и хотя бы один расход.' }],
    };
  if (records.length > maxImportRows)
    return {
      rows: [],
      issues: [
        { row: 1, message: `В одном файле можно импортировать до ${maxImportRows} расходов.` },
      ],
    };
  const columns: Partial<Record<keyof typeof aliases, number>> = {};
  header.forEach((name, index) => {
    const key = Object.entries(aliases).find(([, names]) =>
      names.includes(normalizeHeader(name)),
    )?.[0] as keyof typeof aliases | undefined;
    if (key) {
      if (columns[key] !== undefined)
        issues.push({ row: 1, message: `Колонка «${name}» указана несколько раз.` });
      columns[key] = index;
    }
  });
  for (const [key, label] of [
    ['date', 'Дата'],
    ['amount', 'Сумма'],
    ['category', 'Категория'],
  ] as const) {
    if (columns[key] === undefined)
      issues.push({ row: 1, message: `Не найдена обязательная колонка «${label}».` });
  }
  if (issues.length) return { rows: [], issues };
  const rows: ImportRow[] = [];
  records.forEach((record, index) => {
    const row = index + 2;
    const get = (key: keyof typeof aliases) =>
      columns[key] === undefined ? '' : (record[columns[key]!] ?? '');
    const date = dateValue(get('date'));
    const amount = parseAmount(get('amount'));
    const category = textValue(get('category')).trim();
    const author = textValue(get('author')).trim() || defaultAuthor.trim();
    const problems: string[] = [];
    if (record.length > header.length)
      problems.push('лишние колонки: проверьте кавычки и разделители');
    if (!date) problems.push('дата должна быть в формате YYYY-MM-DD или DD.MM.YYYY');
    if (amount === null)
      problems.push('сумма должна быть больше нуля и не превышать 999,999,999.99 ₽');
    if (!category || category.length > 40)
      problems.push('название категории должно содержать от 1 до 40 символов');
    if (!author || author.length > 40)
      problems.push('имя автора должно содержать от 1 до 40 символов');
    if (problems.length) issues.push({ row, message: problems.join('; ') });
    else rows.push({ id: crypto.randomUUID(), date: date!, amount: amount!, category, author });
  });
  return { rows, issues };
}
const fingerprint = (row: Omit<ImportRow, 'id'>) =>
  JSON.stringify([row.date, row.amount, categoryKey(row.category), row.author]);
export function planImport(rows: ImportRow[], data: Data, skipDuplicates = true) {
  const counts = new Map<string, number>();
  const categoryNames = new Map(data.categories.map((category) => [category.id, category.name]));
  const existingIds = new Set(data.expenses.map((expense) => expense.id));
  for (const expense of data.expenses) {
    const key = fingerprint({
      date: expense.spent_on,
      amount: expense.amount_kopecks,
      category: categoryNames.get(expense.category_id) ?? '',
      author: expense.device_name,
    });
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let skipped = 0;
  const pending = rows.filter((row) => {
    const key = fingerprint(row);
    const matches = counts.get(key) ?? 0;
    if (matches) counts.set(key, matches - 1);
    if (existingIds.has(row.id) || (skipDuplicates && matches > 0)) {
      skipped++;
      return false;
    }
    return true;
  });
  const known = new Set(data.categories.map((category) => categoryKey(category.name)));
  const newCategories = new Map<string, string>();
  for (const row of pending)
    if (!known.has(categoryKey(row.category)) && !newCategories.has(categoryKey(row.category)))
      newCategories.set(categoryKey(row.category), row.category);
  return { rows: pending, skipped, newCategories: [...newCategories.values()] };
}
