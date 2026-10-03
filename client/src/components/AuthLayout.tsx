import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="blob -top-56 -left-56 h-[40rem] w-[40rem] bg-accent" />
      <div className="blob -right-64 -bottom-64 h-[46rem] w-[46rem] bg-accent-2" style={{ animationDelay: '-7s' }} />
      <div className="blob top-1/4 left-1/3 h-[28rem] w-[28rem] bg-indigo-600" style={{ animationDelay: '-12s', opacity: 0.25 }} />
      <div className="grain" />
      <div className="absolute top-6 left-6 md:top-8 md:left-10">
        <Logo />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-md rounded-3xl border border-line bg-surface-1/90 p-8 shadow-2xl shadow-black/50 md:p-10"
      >
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-display text-3xl font-bold">
          {title}
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="mt-1.5 mb-7 text-muted">
          {subtitle}
        </motion.p>
        {children}
      </motion.div>
    </div>
  );
}
