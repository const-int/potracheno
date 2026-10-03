import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert } from 'lucide-react';

export type ToastNotice = { id: number; message: string; kind: 'success' | 'error' };

export default function Toast({
  notice,
  onClose,
}: {
  notice: ToastNotice;
  onClose: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    // The browser's top layer also keeps feedback visible above open settings dialogs.
    if (element && typeof element.showPopover === 'function') {
      element.showPopover();
      return () => {
        if (element.matches(':popover-open')) element.hidePopover();
      };
    }
  }, []);
  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), 1800);
    const remove = setTimeout(() => onClose(notice.id), 2040);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [notice.id, onClose]);
  const Icon = notice.kind === 'success' ? Check : CircleAlert;
  return createPortal(
    <div
      ref={ref}
      popover="manual"
      className={`app-toast app-toast-${notice.kind} ${leaving ? 'is-leaving' : ''}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className="app-toast-icon" aria-hidden="true">
        <Icon size={24} strokeWidth={2.5} />
      </span>
      <span className="app-toast-message">{notice.message}</span>
    </div>,
    document.body,
  );
}
