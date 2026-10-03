import { settingsStore } from './settings';

let ctx: AudioContext | null = null;

function context() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(notes: Array<[frequency: number, start: number, duration: number]>, volume = 0.08) {
  if (!settingsStore.get().sounds) return;
  const audio = context();
  const now = audio.currentTime;
  for (const [frequency, start, duration] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(volume, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  }
}

export const sounds = {
  join: () => tone([[523, 0, 0.12], [784, 0.09, 0.18]]),
  leave: () => tone([[659, 0, 0.12], [440, 0.09, 0.2]]),
  mute: () => tone([[392, 0, 0.08]], 0.05),
  unmute: () => tone([[587, 0, 0.08]], 0.05),
  notify: () => tone([[880, 0, 0.1], [1175, 0.1, 0.16]], 0.06),
  message: () => tone([[988, 0, 0.07], [1319, 0.07, 0.12]], 0.05),
};

/** Toca o toque de chamada em loop até a função retornada ser chamada. */
export function startRingtone(): () => void {
  const ring = () => tone([[784, 0, 0.18], [988, 0.2, 0.18], [784, 0.4, 0.18], [988, 0.6, 0.3]], 0.07);
  ring();
  const timer = window.setInterval(ring, 2000);
  return () => window.clearInterval(timer);
}
