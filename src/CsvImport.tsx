import { useMemo, useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { type Data, money, today } from './lib/model';
import { parseImport, planImport, type ParsedImport } from './lib/csv-import';
import { errorMessage, importExpenses } from './lib/store';

export default function CsvImport({
  data,
  demo,
  userId,
  userName,
  onComplete,
  onBusy,
}: {
  data: Data;
  demo: boolean;
  userId: string;
  userName: string;
  onComplete: (result: { imported: number; skipped: number }) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [filename, setFilename] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const readVersion = useRef(0);
  const locked = useRef(false);
  const plan = useMemo(
    () => planImport(parsed?.rows ?? [], data, skipDuplicates),
    [parsed, data, skipDuplicates],
  );
  async function read(file?: File) {
    const version = ++readVersion.current;
    setParsed(null);
    setError('');
    setReading(false);
    setFilename(file?.name ?? '');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Выберите CSV размером до 5 МБ.');
      return;
    }
    setReading(true);
    try {
      const bytes = await file.arrayBuffer();
      let text: string;
      const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
      if (prefix[0] === 255 && prefix[1] === 254) text = new TextDecoder('utf-16le').decode(bytes);
      else {
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          text = new TextDecoder('windows-1251').decode(bytes);
        }
      }
      if (version === readVersion.current) setParsed(parseImport(text, userName));
    } catch {
      if (version === readVersion.current)
        setError('Не удалось прочитать файл. Выберите его еще раз.');
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  }
  function template() {
    const text = `\uFEFFДата;Сумма;Категория;Автор\r\n${today()};1000;Продукты;\r\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'potracheno-import-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function submit() {
    if (locked.current || !parsed || parsed.issues.length || !plan.rows.length) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const result = await importExpenses(demo, userId, parsed.rows, skipDuplicates);
      await onComplete(result);
    } catch (e) {
      setError(
        errorMessage(e) +
          ' Можно повторить попытку: уже добавленные строки этого файла не продублируются.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="csv-import">
      <p className="muted">
        Обязательные колонки: дата, сумма, категория. Автор — необязательная колонка. Без автора
        будет указано ваше имя.
      </p>
      <fieldset disabled={busy}>
        <button className="text-button import-template" onClick={template}>
          <Download size={16} />
          Скачать шаблон CSV
        </button>
        <label className="csv-file-label">
          Выберите CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void read(event.target.files?.[0])}
          />
        </label>
        {reading && (
          <p className="muted" role="status">
            Читаем файл…
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {parsed && (
          <>
            <p className="csv-filename">{filename}</p>
            {parsed.issues.length > 0 ? (
              <div className="form-error" role="alert">
                <strong>Ошибок: {parsed.issues.length}. Исправьте файл перед импортом.</strong>
                <ul>
                  {parsed.issues.slice(0, 10).map((issue, index) => (
                    <li key={index}>
                      Строка {issue.row}: {issue.message}
                    </li>
                  ))}
                </ul>
                {parsed.issues.length > 10 && <p>Показаны первые 10 ошибок.</p>}
              </div>
            ) : (
              <>
                <div className="import-counts">
                  <span>
                    К добавлению <strong>{plan.rows.length}</strong>
                  </span>
                  <span>
                    Совпадений <strong>{plan.skipped}</strong>
                  </span>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(event) => setSkipDuplicates(event.target.checked)}
                  />
                  Пропускать уже существующие траты
                </label>
                <p className="muted">Совпадение — одинаковые дата, сумма, категория и автор.</p>
                {plan.newCategories.length > 0 && (
                  <p className="muted">Будут созданы категории: {plan.newCategories.join(', ')}.</p>
                )}
                <ul className="import-preview">
                  {plan.rows.slice(0, 3).map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>{row.category}</strong>
                        <span>
                          {row.date} · {row.author}
                        </span>
                      </div>
                      <b>{money(row.amount)}</b>
                    </li>
                  ))}
                </ul>
                {!plan.rows.length && <p className="muted">Новых трат для импорта нет.</p>}
              </>
            )}
            <button
              className="primary full-width"
              disabled={busy || reading || !!parsed.issues.length || !plan.rows.length}
              onClick={() => void submit()}
            >
              <FileUp size={18} />
              {busy ? 'Импортируем…' : `Импортировать траты (${plan.rows.length})`}
            </button>
          </>
        )}
      </fieldset>
    </div>
  );
}
