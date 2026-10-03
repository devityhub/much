import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Use dentro de <AnimatePresence> para animar a saída. */
export default function Modal({ title, subtitle, onClose, children, wide = false }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line bg-surface-2 shadow-2xl shadow-black/50 ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
          <div>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted transition hover:bg-surface-4 hover:text-white" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pt-3 pb-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}
