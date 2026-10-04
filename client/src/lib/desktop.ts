export interface DesktopSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnail: string;
  appIcon: string | null;
}

export interface SystemAudioStatus {
  event: 'ready' | 'sources' | 'error' | 'exit' | 'log';
  sources?: Array<{ pid: number; name: string }>;
  message?: string;
  code?: number | null;
}

export type StartSystemAudioResult = { ok: true } | { ok: false; error: string };

/** system: som do PC sem Discord. spotify: só o Spotify (modo DJ). */
export type CaptureKind = 'system' | 'spotify';

/** API exposta pelo preload do app desktop (desktop/src/preload.ts). */
export interface PassTimeDesktopApi {
  isDesktop: true;
  platform: string;
  /** Ausente em versões antigas do app, que só capturam o som do sistema. */
  captureKinds?: CaptureKind[];
  listSources(): Promise<DesktopSource[]>;
  selectSource(id: string): Promise<void>;
  startSystemAudio(kind?: CaptureKind): Promise<StartSystemAudioResult>;
  stopSystemAudio(kind?: CaptureKind): Promise<void>;
  onSystemAudioData(callback: (chunk: Uint8Array) => void, kind?: CaptureKind): () => void;
  onSystemAudioStatus(callback: (status: SystemAudioStatus) => void, kind?: CaptureKind): () => void;
}

declare global {
  interface Window {
    passtime?: PassTimeDesktopApi;
    much?: PassTimeDesktopApi;
  }
}

export const desktop: PassTimeDesktopApi | null =
  typeof window !== 'undefined' ? (window.passtime ?? window.much ?? null) : null;

export const canCaptureSpotify = Boolean(desktop?.captureKinds?.includes('spotify'));
