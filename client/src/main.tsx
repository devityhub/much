import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import App from './App';
import { AuthProvider } from './lib/auth';
import { useMotionMode } from './lib/performance';
import { ToastProvider } from './context/toast';
import './index.css';

/** No modo leve as animações de movimento (deslizar, crescer, reorganizar listas) viram só um fade. */
function Motion({ children }: { children: ReactNode }) {
  const { lite } = useMotionMode();
  return <MotionConfig reducedMotion={lite ? 'always' : 'never'}>{children}</MotionConfig>;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Motion>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </Motion>
  </BrowserRouter>,
);
