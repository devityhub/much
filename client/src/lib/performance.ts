import { useSyncExternalStore } from 'react';

export type MotionMode = 'auto' | 'lite' | 'full';

const KEY = 'much.motion';

/**
 * Sem placa de vídeo (VM, servidor, área de trabalho remota) o navegador desenha tudo no processador:
 * animações de movimento, desfoques e sombras grandes travam e saem pixeladas.
 */
function detectSoftwareRendering() {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return true;
  }
}

/** Por que o modo automático escolheu o leve (null quando escolheu o completo). */
export const liteReason: string | null = detectSoftwareRendering()
  ? 'este computador está sem aceleração de vídeo'
  : window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'o sistema pede menos animações'
    : null;

function readMode(): MotionMode {
  const saved = localStorage.getItem(KEY);
  return saved === 'lite' || saved === 'full' ? saved : 'auto';
}

let mode = readMode();
const listeners = new Set<() => void>();

const isLite = (m: MotionMode) => m === 'lite' || (m === 'auto' && liteReason !== null);

/** O CSS usa `html[data-lite]` para cortar desfoques, sombras grandes e animações contínuas. */
function apply() {
  document.documentElement.toggleAttribute('data-lite', isLite(mode));
}
apply();

export function setMotionMode(next: MotionMode) {
  mode = next;
  if (next === 'auto') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, next);
  apply();
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useMotionMode() {
  const current = useSyncExternalStore(subscribe, () => mode);
  return { mode: current, lite: isLite(current) };
}
