import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';
import type { SpotifyAccount } from './types';

const POLL_MS = 2000;
const CONNECT_TIMEOUT_MS = 3 * 60_000;

let account: SpotifyAccount | null = null;
let loading: Promise<SpotifyAccount> | null = null;
const listeners = new Set<() => void>();

function setAccount(next: SpotifyAccount | null) {
  account = next;
  for (const listener of listeners) listener();
}

export function refreshSpotifyAccount(): Promise<SpotifyAccount> {
  loading ??= api<SpotifyAccount>('/spotify/me')
    .then((next) => {
      setAccount(next);
      return next;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Conta do Spotify ligada ao usuário (null enquanto carrega). */
export function useSpotifyAccount() {
  const value = useSyncExternalStore(subscribe, () => account);
  useEffect(() => {
    if (!account) void refreshSpotifyAccount().catch(() => undefined);
  }, []);
  return value;
}

/**
 * Abre o login do Spotify (popup no navegador, navegador do sistema no app desktop)
 * e espera a conta aparecer ligada no servidor.
 */
export async function connectSpotify(): Promise<SpotifyAccount> {
  const { url } = await api<{ url: string }>('/spotify/authorize', { method: 'POST' });
  window.open(url, 'much-spotify', 'width=480,height=760');

  return new Promise<SpotifyAccount>((resolve, reject) => {
    const started = Date.now();
    let done = false;
    const finish = (result: SpotifyAccount | Error) => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const check = async () => {
      try {
        const next = await refreshSpotifyAccount();
        if (next.linked) finish(next);
      } catch {
        // tenta de novo no próximo ciclo
      }
      if (Date.now() - started > CONNECT_TIMEOUT_MS) finish(new Error('Tempo esgotado para conectar o Spotify'));
    };
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'much:spotify') void check();
    };
    const timer = window.setInterval(() => void check(), POLL_MS);
    window.addEventListener('message', onMessage);
  });
}

export async function disconnectSpotify() {
  await api('/spotify', { method: 'DELETE' });
  await refreshSpotifyAccount();
}

/** Chaves do app do Spotify, cadastradas pelo dono do servidor em Conexões. */
export async function saveSpotifyConfig(clientId: string, clientSecret: string) {
  await api('/spotify/config', { method: 'PUT', body: { clientId, clientSecret } });
  return refreshSpotifyAccount();
}

export async function clearSpotifyConfig() {
  await api('/spotify/config', { method: 'DELETE' });
  return refreshSpotifyAccount();
}

export interface SearchResult {
  tracks: import('./types').SpotifyTrack[];
}

export function searchSpotify(q: string) {
  return api<SearchResult>(`/spotify/search?q=${encodeURIComponent(q)}`);
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
