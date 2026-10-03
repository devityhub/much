import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';
import type { SpotifyAccount } from './types';

const POLL_MS = 1500;
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
 * Abre o login do Spotify (popup) e espera a conta aparecer ligada no servidor.
 * O popup é aberto no mesmo clique do usuário para o navegador não bloquear.
 */
export async function connectSpotify(): Promise<SpotifyAccount> {
  // Abrir no gesto do clique; depois navega para a URL do OAuth.
  const popup = window.open('about:blank', 'much-spotify', 'width=520,height=780,noopener=no');
  if (popup) {
    try {
      popup.document.write(
        '<!doctype html><title>Spotify</title><body style="margin:0;background:#0c0d11;color:#b3b3b3;font:15px/1.4 system-ui;display:flex;align-items:center;justify-content:center;height:100vh">Abrindo login do Spotify…</body>',
      );
    } catch {
      // cross-origin / closed
    }
  }

  let url: string;
  try {
    ({ url } = await api<{ url: string }>('/spotify/authorize', { method: 'POST' }));
  } catch (err) {
    popup?.close();
    throw err;
  }

  if (popup && !popup.closed) {
    popup.location.href = url;
    popup.focus();
  } else {
    // Popup bloqueado: vai na mesma aba (usuário volta pelo histórico).
    window.location.assign(url);
    throw new Error('Abra o login do Spotify e autorize a conexão. Depois volte ao Much.');
  }

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
        if (next.linked) {
          try {
            popup.close();
          } catch {
            // ignore
          }
          finish(next);
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
      if (popup.closed && Date.now() - started > 4000) {
        // Usuário fechou sem conectar — confirma no servidor antes de desistir.
        try {
          const next = await refreshSpotifyAccount();
          if (next.linked) finish(next);
          else finish(new Error('Conexão com o Spotify cancelada'));
        } catch {
          finish(new Error('Conexão com o Spotify cancelada'));
        }
        return;
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

/** Preferências estilo Discord: perfil e status. */
export async function updateSpotifyPrefs(prefs: { showOnProfile?: boolean; showAsStatus?: boolean }) {
  const next = await api<SpotifyAccount>('/spotify/me', { method: 'PATCH', body: prefs });
  setAccount(next);
  return next;
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
