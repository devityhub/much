import crypto from 'node:crypto';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from './auth';
import { queries } from './db';
import { asyncHandler, HttpError } from './http';
import { music } from './music';
import { authorizeUrl, linkAccount, searchTracks, spotifyFetch, verifySpotifyAppCredentials } from './spotifyApi';
import {
  canConfigureSpotify,
  clearSpotifyCredentials,
  redirectUriFor,
  saveSpotifyCredentials,
  spotifyConfigured,
  spotifyFromEnv,
} from './spotifyConfig';
import { spotifyPresence } from './spotifyPresence';

const STATE_TTL_MS = 30 * 60_000;

const PLAYER_ACTIONS: Record<string, { method: 'PUT' | 'POST'; path: string }> = {
  play: { method: 'PUT', path: '/me/player/play' },
  pause: { method: 'PUT', path: '/me/player/pause' },
  next: { method: 'POST', path: '/me/player/next' },
  previous: { method: 'POST', path: '/me/player/previous' },
};

const playSchema = z.object({ uri: z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/, 'Música inválida') });
const searchSchema = z.object({ q: z.string().trim().min(1, 'Digite o que procurar').max(100) });

/** Client ID e Client Secret do painel do Spotify: 32 caracteres hexadecimais. */
const key = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{20,64}$/, `${label} parece inválido: copie do painel do Spotify`);
const configSchema = z.object({ clientId: key('O Client ID'), clientSecret: key('O Client Secret') });

function requireConfigured() {
  if (!spotifyConfigured()) {
    throw new HttpError(
      503,
      'Falta liberar o Spotify neste Much (Client ID/Secret do app). Depois disso, Conectar abre o login da sua conta.',
    );
  }
}

/** Mexer nas chaves muda o Spotify de todo mundo na instância. */
function requireConfigurator(res: Response) {
  const me = currentUser(res);
  if (!canConfigureSpotify(me.id)) throw new HttpError(403, 'Você não pode configurar o Spotify neste servidor');
  if (spotifyFromEnv()) throw new HttpError(409, 'As chaves do Spotify vêm do .env deste servidor');
  return me;
}

/** Comandos de player só para quem está tocando música em alguma sala agora. */
function requireDj(res: Response) {
  const me = currentUser(res);
  const roomId = music.roomOfDj(me.id);
  if (!roomId) throw new HttpError(403, 'Só quem está tocando a música pode controlar');
  return { me, roomId };
}

function callbackPage(ok: boolean, message: string) {
  const color = ok ? '#1db954' : '#f04452';
  const safe = message.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Much + Spotify</title></head>
<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0c0d11;color:#fff;font-family:Segoe UI,Arial,sans-serif;text-align:center">
<div style="font-size:22px;font-weight:700;color:${color}">${ok ? 'Spotify conectado!' : 'Não deu para conectar'}</div>
<div style="color:#9097a6;max-width:420px">${safe}</div>
<script>
try { window.opener && window.opener.postMessage({ type: 'much:spotify', ok: ${ok} }, '*'); } catch (e) {}
setTimeout(function () { window.close(); }, ${ok ? 1200 : 4000});
</script>
</body></html>`;
}

export const spotifyRouter = Router();

spotifyRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    queries.purgeSpotifyOAuthStates.run(Date.now());
    const row = state ? queries.takeSpotifyOAuthState.get(state) : undefined;
    if (row) queries.deleteSpotifyOAuthState.run(state);
    if (!row || row.expires_at < Date.now()) {
      res.status(400).send(callbackPage(false, 'O link de conexão expirou. Volte ao Much e clique em Conectar de novo.'));
      return;
    }
    if (req.query.error || !code) {
      res.send(callbackPage(false, 'Você cancelou a conexão com o Spotify.'));
      return;
    }
    try {
      await linkAccount(row.user_id, code, row.redirect_uri);
      // Já começa a acompanhar: a atividade aparece no perfil sem precisar recarregar nada.
      spotifyPresence.watch(row.user_id);
      res.send(callbackPage(true, 'Pode fechar esta janela e voltar ao Much.'));
    } catch (err) {
      const message = (err as Error).message;
      // Secret errado: limpa as chaves para o modal de liberar abrir de novo.
      if ((err as { code?: string }).code === 'invalid_client' || /client secret|invalid_client|secret inválido/i.test(message)) {
        if (!spotifyFromEnv()) clearSpotifyCredentials();
      }
      res.status(400).send(callbackPage(false, message));
    }
  }),
);

spotifyRouter.use(requireAuth);

spotifyRouter.get('/me', (req, res) => {
  const me = currentUser(res);
  const account = queries.spotifyAccount.get(me.id);
  res.json({
    configured: spotifyConfigured(),
    linked: Boolean(account),
    name: account?.display_name ?? null,
    premium: account?.product === 'premium',
    showOnProfile: account ? Boolean(account.show_on_profile) : true,
    showAsStatus: account ? Boolean(account.show_as_status) : true,
    canConfigure: canConfigureSpotify(me.id),
    fromEnv: spotifyFromEnv(),
    redirectUri: redirectUriFor(req),
  });
});

const prefsSchema = z.object({
  showOnProfile: z.boolean().optional(),
  showAsStatus: z.boolean().optional(),
});

spotifyRouter.patch('/me', (req, res) => {
  const me = currentUser(res);
  const account = queries.spotifyAccount.get(me.id);
  if (!account) throw new HttpError(400, 'Conecte o Spotify primeiro');
  const prefs = prefsSchema.parse(req.body);
  const showOnProfile = prefs.showOnProfile ?? Boolean(account.show_on_profile);
  const showAsStatus = prefs.showAsStatus ?? Boolean(account.show_as_status);
  queries.updateSpotifyPrefs.run(showOnProfile ? 1 : 0, showAsStatus ? 1 : 0, me.id);
  spotifyPresence.unwatch(me.id);
  if (showOnProfile || showAsStatus) spotifyPresence.watch(me.id);
  spotifyPresence.sync(me.id);
  res.json({
    configured: spotifyConfigured(),
    linked: true,
    name: account.display_name,
    premium: account.product === 'premium',
    showOnProfile,
    showAsStatus,
    canConfigure: canConfigureSpotify(me.id),
    fromEnv: spotifyFromEnv(),
    redirectUri: redirectUriFor(req),
  });
});

spotifyRouter.put(
  '/config',
  asyncHandler(async (req, res) => {
    requireConfigurator(res);
    const { clientId, clientSecret } = configSchema.parse(req.body);
    if (clientId === clientSecret) {
      throw new HttpError(
        400,
        'O Client Secret está igual ao Client ID. No Spotify, clique em “Ver segredo do cliente” e cole o secret correto.',
      );
    }
    // Valida com o Spotify antes de gravar — evita OAuth que falha com “Invalid client secret”.
    await verifySpotifyAppCredentials(clientId, clientSecret);
    saveSpotifyCredentials(clientId, clientSecret);
    spotifyPresence.unwatchAll();
    res.json({ ok: true });
  }),
);

spotifyRouter.delete('/config', (_req, res) => {
  requireConfigurator(res);
  clearSpotifyCredentials();
  spotifyPresence.unwatchAll();
  res.status(204).end();
});

spotifyRouter.post('/authorize', (req, res) => {
  requireConfigured();
  const me = currentUser(res);
  const now = Date.now();
  queries.purgeSpotifyOAuthStates.run(now);
  const state = crypto.randomBytes(24).toString('hex');
  const redirectUri = redirectUriFor(req);
  // Persistido no SQLite: restart do servidor no meio do login não “expira” o link.
  queries.putSpotifyOAuthState.run(state, me.id, redirectUri, now + STATE_TTL_MS);
  res.json({ url: authorizeUrl(state, redirectUri) });
});

spotifyRouter.delete('/', (_req, res) => {
  const me = currentUser(res);
  queries.deleteSpotifyAccount.run(me.id);
  spotifyPresence.unwatch(me.id);
  res.status(204).end();
});

spotifyRouter.post(
  '/player/:action',
  asyncHandler(async (req, res) => {
    requireConfigured();
    const action = PLAYER_ACTIONS[req.params.action];
    if (!action) throw new HttpError(404, 'Comando inválido');
    const { me, roomId } = requireDj(res);
    await spotifyFetch(me.id, action.path, { method: action.method });
    music.refreshSoon(roomId);
    res.json({ ok: true });
  }),
);

spotifyRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    requireConfigured();
    const { me } = requireDj(res);
    const { q } = searchSchema.parse(req.query);
    res.json({ tracks: await searchTracks(me.id, q) });
  }),
);

spotifyRouter.post(
  '/play',
  asyncHandler(async (req, res) => {
    requireConfigured();
    const { me, roomId } = requireDj(res);
    const { uri } = playSchema.parse(req.body);
    await spotifyFetch(me.id, '/me/player/play', { method: 'PUT', body: { uris: [uri] } });
    music.refreshSoon(roomId);
    res.json({ ok: true });
  }),
);
