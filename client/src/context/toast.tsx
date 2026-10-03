import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type Tone = 'info' | 'error' | 'success';

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

const ICONS = { info: Info, error: AlertCircle, success: CheckCircle2 };
const COLORS = { info: 'text-sky-400', error: 'text-danger', success: 'text-ok' };

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-[100] flex w-full max-w-sm flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface-4/95 px-4 py-3 text-sm shadow-2xl shadow-black/40 backdrop-blur"
              >
                <Icon size={18} className={`shrink-0 ${COLORS[toast.tone]}`} />
                <span>{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider');
  return ctx;
}
