import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Check, CircleAlert, Save, X } from 'lucide-react';

export type ToastNotice = {
  id: number;
  message: string;
  kind: 'success' | 'error';
  placement?: 'expense';
  expense?: { categoryName: string; icon: ReactNode; saveComment: (note: string) => Promise<void> };
};

function expenseAnchor(placement?: 'expense') {
  const keypad = placement === 'expense' ? document.querySelector('.expense-keypad') : null;
  if (!keypad) return null;
  return {
    top: Math.ceil(document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0),
    bottom: Math.ceil(window.innerHeight - keypad.getBoundingClientRect().top + 12),
  };
}

export default function Toast({
  notice,
  onClose,
}: {
  notice: ToastNotice;
  onClose: (id: number) => void;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  const remaining = useRef(2800);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState<'return' | 'dismiss' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [anchor, setAnchor] = useState(() => expenseAnchor(notice.placement));
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (notice.placement !== 'expense') return;
    const reposition = () => {
      const next = expenseAnchor(notice.placement);
      setAnchor((current) =>
        current?.top === next?.top && current?.bottom === next?.bottom ? current : next,
      );
    };
    const observer = new ResizeObserver(reposition);
    for (const element of document.querySelectorAll('.expense-keypad, .topbar, .quick-entry'))
      observer.observe(element);
    window.addEventListener('resize', reposition);
    reposition();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [notice.placement]);
  useLayoutEffect(() => {
    const element = ref.current;
    // The browser's top layer also keeps feedback visible above open settings dialogs.
    if (element && typeof element.showPopover === 'function') {
      element.showPopover();
      return () => {
        if (element.matches(':popover-open')) element.hidePopover();
      };
    }
  }, [!!anchor]);
  useEffect(() => {
    if (settling !== 'return') return;
    const finish = setTimeout(() => setSettling(null), 240);
    return () => clearTimeout(finish);
  }, [settling]);
  useEffect(() => {
    if (commentOpen || dragging || settling === 'return') return;
    if (leaving) {
      const remove = setTimeout(() => onClose(notice.id), 240);
      return () => clearTimeout(remove);
    }
    const started = performance.now();
    const leave = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      remaining.current = Math.max(0, remaining.current - (performance.now() - started));
      clearTimeout(leave);
    };
  }, [notice.id, onClose, commentOpen, dragging, leaving, settling]);
  const cancelDrag = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setDragging(false);
    setDrag({ x: 0, y: 0 });
    setSettling('return');
  };
  const swipe = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (
        commentOpen ||
        leaving ||
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as Element).closest('button')
      )
        return;
      gesture.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      setSettling(null);
      setDragging(true);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (gesture.current)
        setDrag({ x: event.clientX - gesture.current.x, y: event.clientY - gesture.current.y });
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      if (!gesture.current) return;
      const x = event.clientX - gesture.current.x;
      const y = event.clientY - gesture.current.y;
      gesture.current = null;
      setDragging(false);
      if (Math.hypot(x, y) > 65) {
        const distance = Math.hypot(x, y);
        const travel = Math.max(window.innerWidth, window.innerHeight) + 100;
        setDrag({ x: (x / distance) * travel, y: (y / distance) * travel });
        setSettling('dismiss');
        setLeaving(true);
      } else {
        setDrag({ x: 0, y: 0 });
        setSettling('return');
      }
    },
    onPointerCancel: cancelDrag,
    onLostPointerCapture: cancelDrag,
  };
  const Icon = notice.kind === 'success' ? Check : CircleAlert;
  const content = notice.expense ? (
    <>
      <span className="app-toast-category-icon" aria-hidden="true">
        {notice.expense.icon}
      </span>
      <strong className="app-toast-message app-toast-amount">{notice.message}</strong>
      <span className={`app-toast-comment-action ${commentSaved ? 'is-saved' : ''}`}>
        <button
          type="button"
          className="app-toast-comment"
          disabled={leaving || commentSaved}
          aria-hidden={commentSaved || undefined}
          tabIndex={commentSaved ? -1 : undefined}
          onClick={() => {
            // Commit and focus during the tap so iOS can open its software keyboard.
            flushSync(() => setCommentOpen(true));
          }}
        >
          <span>Комментарий</span>
        </button>
        {commentSaved && (
          <svg
            className="app-toast-comment-saved"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Комментарий сохранён"
          >
            <path d="M4 12 9 17 20 6" />
          </svg>
        )}
      </span>
    </>
  ) : (
    <>
      <span className="app-toast-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.5} />
      </span>
      <span className="app-toast-message">{notice.message}</span>
    </>
  );
  const className = `app-toast app-toast-${notice.kind} ${notice.expense ? 'app-toast-expense' : ''} ${leaving ? 'is-leaving' : ''} ${dragging ? 'is-dragging' : ''} ${settling === 'dismiss' ? 'is-swiping-out' : ''}`;
  const accessibleLabel = notice.expense
    ? `${notice.expense.categoryName}: ${notice.message}`
    : undefined;
  const modal =
    commentOpen && notice.expense
      ? createPortal(
          <CommentDialog
            onClose={() => setCommentOpen(false)}
            onSave={async (note) => {
              await notice.expense!.saveComment(note);
              // Let the success transition finish even when the toast had little time left.
              remaining.current = Math.max(remaining.current, 1800);
              setCommentSaved(true);
              setCommentOpen(false);
            }}
          />,
          document.body,
        )
      : null;
  // Individual translate keeps the gesture separate from the entry/exit transform animation.
  const dragStyle = {
    translate: `${drag.x}px ${drag.y}px`,
    filter: `opacity(${settling === 'dismiss' ? 0 : Math.max(0.3, 1 - Math.hypot(drag.x, drag.y) / 300)})`,
  };
  if (anchor)
    return (
      <>
        {modal}
        {createPortal(
          <div ref={ref} popover="manual" className="expense-toast-zone" style={anchor}>
            <div
              {...swipe}
              style={dragStyle}
              className={className}
              role="status"
              aria-atomic="true"
              aria-label={accessibleLabel}
            >
              {content}
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  return (
    <>
      {modal}
      {createPortal(
        <div
          ref={ref}
          {...swipe}
          style={dragStyle}
          popover="manual"
          className={className}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
          aria-label={accessibleLabel}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}

function CommentDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  useLayoutEffect(() => {
    dialog.current?.showModal();
    input.current?.focus();
  }, []);
  const close = () => {
    if (!locked.current) onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="modal comment-modal"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="modal-heading">
        <h2>Комментарий к трате</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть"
          onClick={close}
          disabled={busy}
        >
          <X size={22} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked.current) return;
          locked.current = true;
          setBusy(true);
          setError('');
          try {
            await onSave(note.trim());
          } catch {
            setError('Не удалось сохранить комментарий. Попробуйте ещё раз.');
          } finally {
            locked.current = false;
            setBusy(false);
          }
        }}
      >
        <input
          ref={input}
          className="expense-comment-input"
          aria-label="Комментарий"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          disabled={busy}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="category-form-actions">
          <button type="button" className="secondary" onClick={close} disabled={busy}>
            Отмена
          </button>
          <button className="primary" disabled={busy || !note.trim()}>
            <Save size={17} />
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
