import { LoaderCircle } from 'lucide-react';

export default function StartupScreen({
  error,
  onRetry,
  onLogout,
}: {
  error?: string;
  onRetry?: () => void;
  onLogout?: () => void;
}) {
  return (
    <div className="startup-screen" aria-busy={!error}>
      <img
        className="startup-logo"
        src={`${import.meta.env.BASE_URL}icon.svg`}
        width={80}
        height={80}
        alt="potracheno"
      />
      {error ? (
        <div className="startup-error">
          <p className="form-error" role="alert">
            {error}
          </p>
          <button type="button" className="primary full-width" onClick={onRetry}>
            Повторить загрузку
          </button>
          {onLogout && (
            <button type="button" className="text-button" onClick={onLogout}>
              Выйти
            </button>
          )}
        </div>
      ) : (
        <span className="startup-progress" role="status" aria-label="Загружаем приложение">
          <LoaderCircle size={20} className="startup-spinner" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
