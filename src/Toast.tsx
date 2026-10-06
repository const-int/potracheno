import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert } from 'lucide-react';

export type ToastNotice = {
  id: number;
  message: string;
  kind: 'success' | 'error';
  placement?: 'expense';
  expense?: { categoryName: string; icon: ReactNode };
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
    const leave = setTimeout(() => setLeaving(true), 1800);
    const remove = setTimeout(() => onClose(notice.id), 2040);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [notice.id, onClose]);
  const Icon = notice.kind === 'success' ? Check : CircleAlert;
  const content = notice.expense ? (
    <>
      <span className="app-toast-category-icon" aria-hidden="true">
        {notice.expense.icon}
      </span>
      <span className="app-toast-message">{notice.expense.categoryName}</span>
      <strong className="app-toast-amount">{notice.message}</strong>
    </>
  ) : (
    <>
      <span className="app-toast-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.5} />
      </span>
      <span className="app-toast-message">{notice.message}</span>
    </>
  );
  const className = `app-toast app-toast-${notice.kind} ${notice.expense ? 'app-toast-expense' : ''} ${leaving ? 'is-leaving' : ''}`;
  const accessibleLabel = notice.expense
    ? `${notice.expense.categoryName}: ${notice.message}`
    : undefined;
  if (anchor)
    return createPortal(
      <div ref={ref} popover="manual" className="expense-toast-zone" style={anchor}>
        <div className={className} role="status" aria-atomic="true" aria-label={accessibleLabel}>
          {content}
        </div>
      </div>,
      document.body,
    );
  return createPortal(
    <div
      ref={ref}
      popover="manual"
      className={className}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      aria-label={accessibleLabel}
    >
      {content}
    </div>,
    document.body,
  );
}
