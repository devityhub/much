import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import AuthBackdrop from './AuthBackdrop';
import Logo from './Logo';
import { Button } from './ui';

export default function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <AuthBackdrop />
      <div className="absolute top-6 left-6 z-10 md:top-8 md:left-10">
        <Logo />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className={`relative w-full rounded-3xl border border-line bg-surface-1/90 p-8 shadow-2xl shadow-black/50 md:p-10 ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function AuthLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted uppercase">
      {children}
      {required && (
        <span className="ml-1 text-danger" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export function AuthInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

export function AuthSelect({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`input ${className}`} {...props} />;
}

export function AuthError({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -4, 0] }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function AuthSubmit({ busy, idle, busyLabel }: { busy: boolean; idle: string; busyLabel: string }) {
  return (
    <Button type="submit" disabled={busy} size="lg" className="mt-1 w-full">
      {busy ? busyLabel : idle}
    </Button>
  );
}

export function AuthLink({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={`font-semibold text-accent hover:underline ${className}`} {...rest}>
      {children}
    </button>
  );
}
