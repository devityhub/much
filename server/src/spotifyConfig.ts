import type { Request } from 'express';
import { config } from './config';
import { queries } from './db';

const CLIENT_ID_KEY = 'spotify.client_id';
const CLIENT_SECRET_KEY = 'spotify.client_secret';

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
  /** Fixa no .env; quando vazia, cada pedido usa o endereço por onde o Much foi aberto. */
  redirectUri: string;
}

function saved(key: string) {
  return queries.setting.get(key)?.value ?? '';
}

/**
 * O .env manda quando está preenchido; senão valem as chaves salvas em Conexões.
 * Ficam no banco em texto puro, mesmo nível de segredo do .env ao lado dele.
 */
export function spotifyCredentials(): SpotifyCredentials {
  const fromEnv = Boolean(config.spotify.clientId && config.spotify.clientSecret);
  return {
    clientId: fromEnv ? config.spotify.clientId : saved(CLIENT_ID_KEY),
    clientSecret: fromEnv ? config.spotify.clientSecret : saved(CLIENT_SECRET_KEY),
    redirectUri: config.spotify.redirectUri,
  };
}

/** True quando as chaves vêm do .env: aí a tela de Conexões não deixa editar por cima. */
export function spotifyFromEnv() {
  return Boolean(config.spotify.clientId && config.spotify.clientSecret);
}

export function spotifyConfigured() {
  const { clientId, clientSecret } = spotifyCredentials();
  return Boolean(clientId && clientSecret);
}

export function saveSpotifyCredentials(clientId: string, clientSecret: string) {
  const changed = saved(CLIENT_ID_KEY) !== clientId;
  queries.setSetting.run(CLIENT_ID_KEY, clientId);
  queries.setSetting.run(CLIENT_SECRET_KEY, clientSecret);
  // Tokens antigos pertencem ao app antigo do Spotify e não valem mais nada.
  if (changed) queries.clearSpotifyAccounts.run();
}

export function clearSpotifyCredentials() {
  queries.deleteSetting.run(CLIENT_ID_KEY);
  queries.deleteSetting.run(CLIENT_SECRET_KEY);
  queries.clearSpotifyAccounts.run();
}

/**
 * Endereço de volta do login do Spotify. Sem SPOTIFY_REDIRECT_URI no .env, sai do próprio
 * pedido, então vale tanto em `npm run dev` quanto no servidor publicado.
 * O Spotify recusa `localhost` em http, só o IP 127.0.0.1.
 */
export function redirectUriFor(req: Request) {
  if (config.spotify.redirectUri) return config.spotify.redirectUri;
  const host = (req.get('host') ?? `127.0.0.1:${config.port}`).replace(/^localhost(?=$|:)/, '127.0.0.1');
  const proto = req.protocol === 'https' ? 'https' : 'http';
  return `${proto}://${host}/api/spotify/callback`;
}

/** Só o dono do servidor mexe nas chaves: elas valem para todo mundo que usa a instância. */
export function isServerOwner(userId: number) {
  return queries.firstUserId.get()?.id === userId;
}
