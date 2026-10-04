import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import AuthBackdrop from './AuthBackdrop';
import Logo from './Logo';

export default function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <AuthBackdrop />
      <div className="absolute top-6 left-6 z-10 md:top-8 md:left-10">
        <Logo />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className={`relative w-full rounded-lg bg-[#313338] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${wide ? 'max-w-[830px]' : 'max-w-[480px]'}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function AuthLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-xs font-bold text-[#b5bac1]">
      {children}
      {required && (
        <span className="ml-0.5 text-[#f23f42]" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="auth-input" {...props} />;
}

export function AuthSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="auth-input auth-select" {...props} />;
}

export function AuthError({ error }: { error: string }) {
  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -3, 0] }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-md bg-[rgba(242,63,66,0.12)] px-3 py-2 text-sm text-[#ff8d8d]"
        >
          {error}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function AuthSubmit({ busy, idle, busyLabel }: { busy: boolean; idle: string; busyLabel: string }) {
  return (
    <button type="submit" disabled={busy} className="auth-submit">
      {busy ? busyLabel : idle}
    </button>
  );
}

export function AuthLink({ children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={`auth-link ${className}`} {...rest}>
      {children}
    </button>
  );
}
