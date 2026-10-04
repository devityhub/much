import { useEffect, useRef } from 'react';
import { api } from './api';
import type { RoomSnapshot } from './roomClient';
import { useSettings } from './settings';
import { useSpotifyAccount } from './spotify';

/**
 * Quem está na call e tem Spotify ouve a mesma faixa no próprio app (sem escolher aba).
 * O áudio na call continua vindo do app desktop, quando o DJ usa o PassTime no PC.
 */
export function useListenAlong(snapshot: RoomSnapshot | null, deafened: boolean) {
  const settings = useSettings();
  const account = useSpotifyAccount();
  const started = useRef(false);
  const last = useRef('');

  useEffect(() => {
    const music = snapshot?.music;
    const isDj = Boolean(music && music.djSocketId === snapshot?.selfId);
    const canFollow = Boolean(account?.linked && account.premium && music && !isDj);
    const shouldPlay = Boolean(canFollow && music?.track && music.isPlaying && !settings.musicMuted && !deafened);
    const key = shouldPlay ? `${music!.track!.uri}:${music!.isPlaying}` : '';

    if (!shouldPlay) {
      if (started.current) {
        started.current = false;
        last.current = '';
        void api('/spotify/along', { method: 'POST', body: { pause: true } }).catch(() => undefined);
      }
      return;
    }
    if (key === last.current) return;
    last.current = key;
    started.current = true;
    const elapsed = music!.isPlaying ? Math.max(0, Date.now() - music!.receivedAt) : 0;
    const positionMs = Math.min(music!.progressMs + elapsed, Math.max(0, (music!.track!.durationMs || 1) - 1000));
    void api('/spotify/along', { method: 'POST', body: { uri: music!.track!.uri, positionMs } }).catch(() => undefined);
  }, [account?.linked, account?.premium, deafened, settings.musicMuted, snapshot?.music, snapshot?.selfId]);

  useEffect(
    () => () => {
      if (!started.current) return;
      started.current = false;
      void api('/spotify/along', { method: 'POST', body: { pause: true } }).catch(() => undefined);
    },
    [],
  );
}
