import { desktop, type SystemAudioStatus } from './desktop';
import type { SystemAudioHandle } from './systemAudio';

const TAB_SOURCE = { pid: 0, name: 'Aba do navegador' };
const SILENCE_RMS = 0.002;
const SILENCE_GRACE_MS = 5000;

/** Só Chrome e Edge no computador compartilham o áudio de uma aba. */
export const canCaptureTab =
  !desktop &&
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
  'userAgentData' in navigator &&
  !(navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;

function pickerError(err: unknown) {
  const name = (err as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('Escolha a aba do Spotify para tocar para a sala');
  if (name === 'InvalidStateError') return new Error('Clique de novo no botão do Spotify para escolher a aba');
  return err instanceof Error ? err : new Error('Não foi possível compartilhar a aba');
}

/**
 * Pede para o usuário escolher a aba do open.spotify.com e devolve só o áudio dela.
 * Precisa ser chamada dentro do clique, antes de qualquer await.
 * Avisa por `sources` quando a aba fica muda por mais de 5 s (aba errada ou bloqueio do Spotify).
 */
export async function captureSpotifyTab(onStatus: (status: SystemAudioStatus) => void): Promise<SystemAudioHandle> {
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', frameRate: 1, width: { max: 320 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'exclude',
      systemAudio: 'exclude',
      monitorTypeSurfaces: 'exclude',
    } as DisplayMediaStreamOptions);
  } catch (err) {
    throw pickerError(err);
  }

  const video = display.getVideoTracks()[0];
  const track = display.getAudioTracks()[0];
  const surface = (video?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
  if (!track || (surface && surface !== 'browser')) {
    for (const t of display.getTracks()) t.stop();
    throw new Error('Escolha a aba do open.spotify.com (não uma janela ou tela) e deixe "Compartilhar áudio da aba" ligado');
  }
  track.contentHint = 'music';

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let lastSound = Date.now();
  let heard = true;
  onStatus({ event: 'sources', sources: [TAB_SOURCE] });

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    if (Math.sqrt(sum / samples.length) > SILENCE_RMS) lastSound = Date.now();
    const next = Date.now() - lastSound < SILENCE_GRACE_MS;
    if (next !== heard) {
      heard = next;
      onStatus({ event: 'sources', sources: heard ? [TAB_SOURCE] : [] });
    }
  }, 500);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    for (const t of display.getTracks()) t.stop();
    void ctx.close();
  };

  track.addEventListener('ended', () => {
    if (stopped) return;
    onStatus({ event: 'error', message: 'Você parou de compartilhar a aba do Spotify, então a música parou para a sala' });
    onStatus({ event: 'exit', code: null });
    stop();
  });

  return { track, stop };
}
