import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import './ui.css';

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface ToastApi {
  show: (text: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const show = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = next.current++;
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === 'error' ? 5200 : 2600);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`}>
            <Icon name={t.tone === 'error' ? 'info' : 'check'} size={20} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
