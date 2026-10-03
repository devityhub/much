import { config } from './config';
import { queries, type SpotifyAccountRow } from './db';
import { HttpError } from './http';
import { spotifyCredentials } from './spotifyConfig';

const ACCOUNTS_URL = config.spotify.accountsUrl;
const API_URL = config.spotify.apiUrl;
const REFRESH_MARGIN_MS = 60_000;

export const SPOTIFY_SCOPES = ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'];

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
  durationMs: number;
  url: string | null;
}

export interface NowPlaying {
  track: SpotifyTrack | null;
  progressMs: number;
  isPlaying: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

function basicAuth() {
  const { clientId, clientSecret } = spotifyCredentials();
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(`${ACCOUNTS_URL}/api/token`, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
  } catch {
    throw new HttpError(502, 'Não foi possível falar com o Spotify agora');
  }
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const err = new HttpError(res.status === 400 ? 400 : 502, data.error_description || 'O Spotify recusou a conexão');
    (err as HttpError & { code?: string }).code = data.error;
    throw err;
  }
  return data;
}

export function authorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: spotifyCredentials().clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
  });
  return `${ACCOUNTS_URL}/authorize?${params}`;
}

/** Troca o code do OAuth pelos tokens e guarda a conta ligada ao usuário. O redirect tem que ser o mesmo do /authorize. */
export async function linkAccount(userId: number, code: string, redirectUri: string) {
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  if (!tokens.refresh_token) throw new HttpError(502, 'O Spotify não devolveu o token de acesso');
  const res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const me = (await res.json().catch(() => ({}))) as { display_name?: string; id?: string; product?: string };
  if (!res.ok) throw new HttpError(502, 'Não foi possível ler sua conta do Spotify');
  queries.upsertSpotifyAccount.run(
    userId,
    tokens.access_token,
    tokens.refresh_token,
    Date.now() + tokens.expires_in * 1000,
    me.display_name || me.id || 'Spotify',
    me.product ?? '',
  );
}

async function freshToken(account: SpotifyAccountRow, force = false): Promise<string> {
  if (!force && account.expires_at - REFRESH_MARGIN_MS > Date.now()) return account.access_token;
  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: account.refresh_token });
    const refresh = tokens.refresh_token ?? account.refresh_token;
    const expires = Date.now() + tokens.expires_in * 1000;
    queries.updateSpotifyTokens.run(tokens.access_token, refresh, expires, account.user_id);
    account.access_token = tokens.access_token;
    account.refresh_token = refresh;
    account.expires_at = expires;
    return tokens.access_token;
  } catch (err) {
    if ((err as { code?: string }).code === 'invalid_grant') {
      queries.deleteSpotifyAccount.run(account.user_id);
      throw new HttpError(409, 'A conexão com o Spotify expirou. Conecte sua conta de novo');
    }
    throw err;
  }
}

/** Chama a Web API do Spotify em nome do usuário, renovando o token quando preciso. */
export async function spotifyFetch<T>(userId: number, path: string, init: { method?: string; body?: unknown } = {}): Promise<T | null> {
  const account = queries.spotifyAccount.get(userId);
  if (!account) throw new HttpError(409, 'Conecte sua conta do Spotify primeiro');

  const call = async (token: string) => {
    try {
      return await fetch(`${API_URL}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new HttpError(502, 'Não foi possível falar com o Spotify agora');
    }
  };

  let res = await call(await freshToken(account));
  if (res.status === 401) res = await call(await freshToken(account, true));

  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  if (res.ok) return text ? (JSON.parse(text) as T) : null;

  if (res.status === 403) throw new HttpError(403, 'Controlar o Spotify por aqui precisa de uma conta Premium');
  if (res.status === 404) throw new HttpError(404, 'Nenhum Spotify ativo. Abra o Spotify no PC e dê play em alguma música');
  if (res.status === 429) throw new HttpError(429, 'O Spotify pediu para esperar um pouco. Tente de novo em alguns segundos');
  throw new HttpError(502, 'O Spotify respondeu com erro');
}

interface ApiTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  external_urls?: { spotify?: string };
  artists?: Array<{ name: string }>;
  album?: { name: string; images?: Array<{ url: string; width: number }> };
  show?: { name: string; images?: Array<{ url: string; width: number }> };
  images?: Array<{ url: string; width: number }>;
}

function pickImage(images?: Array<{ url: string; width: number }>) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => a.width - b.width);
  return (sorted.find((i) => i.width >= 200) ?? sorted[sorted.length - 1]).url;
}

export function toTrack(item: ApiTrack): SpotifyTrack {
  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    artists: item.artists?.map((a) => a.name).join(', ') || item.show?.name || '',
    album: item.album?.name ?? item.show?.name ?? '',
    image: pickImage(item.album?.images ?? item.images ?? item.show?.images),
    durationMs: item.duration_ms,
    url: item.external_urls?.spotify ?? null,
  };
}

export async function currentlyPlaying(userId: number): Promise<NowPlaying> {
  const data = await spotifyFetch<{ is_playing: boolean; progress_ms: number | null; item: ApiTrack | null }>(
    userId,
    '/me/player/currently-playing?additional_types=track,episode',
  );
  if (!data) return { track: null, progressMs: 0, isPlaying: false };
  return { track: data.item ? toTrack(data.item) : null, progressMs: data.progress_ms ?? 0, isPlaying: data.is_playing };
}

export async function searchTracks(userId: number, q: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q, type: 'track', limit: '8' });
  const data = await spotifyFetch<{ tracks?: { items: ApiTrack[] } }>(userId, `/search?${params}`);
  return (data?.tracks?.items ?? []).filter(Boolean).map(toTrack);
}
