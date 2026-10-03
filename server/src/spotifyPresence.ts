import { queries } from './db';
import { friendIds, hub, setSpotifyActivity, type Activity } from './hub';
import { music } from './music';
import { presence } from './presence';
import { currentlyPlaying, type SpotifyTrack } from './spotifyApi';

/** Ritmo do laço. Cada pessoa tem seu próprio horário da próxima leitura. */
const TICK_MS = 1500;
/** Tocando algo: perto o suficiente para pegar a troca de faixa quase na hora. */
const ACTIVE_MS = 6000;
/** Nada tocando: não vale gastar cota da API do Spotify. */
const IDLE_MS = 20000;
/** Erro na leitura (cota, Spotify fora do ar): espera bem mais antes de tentar de novo. */
const ERROR_MS = 60000;
/** Sem leitura nova nesse tempo, a faixa para de ser mostrada em vez de congelar na tela. */
const STALE_MS = 90000;

export interface Listening {
  track: SpotifyTrack;
  progressMs: number;
  isPlaying: boolean;
  /** Só vem quando a pessoa está tocando essa música para uma sala, como DJ. */
  roomId: string | null;
  roomName: string | null;
  listeners: number;
}

interface Watch {
  userId: number;
  track: SpotifyTrack | null;
  progressMs: number;
  isPlaying: boolean;
  updatedAt: number;
  nextAt: number;
  polling: boolean;
}

const watches = new Map<number, Watch>();

/** Progresso estimado entre duas leituras, igual ao card da sala. */
function reading(watch: Watch | undefined) {
  if (!watch?.track) return null;
  if (Date.now() - watch.updatedAt > STALE_MS) return null;
  const elapsed = watch.isPlaying ? Date.now() - watch.updatedAt : 0;
  return {
    track: watch.track,
    progressMs: Math.min(watch.progressMs + elapsed, watch.track.durationMs),
    isPlaying: watch.isPlaying,
  };
}

/**
 * O que a pessoa está ouvindo agora. Como DJ, o estado da sala é mais fresco (lê a cada 3s),
 * então ele vem primeiro; a sala só aparece se for pública, para não vazar chamada privada.
 */
function listeningOf(userId: number): Listening | null {
  const djRoomId = music.roomOfDj(userId);
  const dj = djRoomId ? music.get(djRoomId) : null;
  const room = djRoomId ? queries.roomById.get(djRoomId) : null;
  const source = dj?.track ? dj : reading(watches.get(userId));
  if (!source?.track) return null;
  return {
    track: source.track,
    progressMs: source.progressMs,
    isPlaying: source.isPlaying,
    roomId: room?.id ?? null,
    roomName: room?.name ?? null,
    listeners: room ? presence.count(room.id) : 0,
  };
}

/** Invisível ou offline não transmite atividade para ninguém, igual ao resto do app. */
function hidden(userId: number) {
  const row = queries.userById.get(userId);
  return !row || row.presence === 'invisible' || !hub.isOnline(userId);
}

function accountAllowsStatus(userId: number) {
  const account = queries.spotifyAccount.get(userId);
  return Boolean(account?.show_as_status);
}

function broadcast(userId: number) {
  const listening = listeningOf(userId);
  // Você sempre vê a sua; amigos só se "Exibir o Spotify como seu status" estiver ligado.
  hub.emitToUser(userId, 'spotify:presence', { userId, listening });
  const forFriends = { userId, listening: hidden(userId) || !accountAllowsStatus(userId) ? null : listening };
  for (const id of friendIds(userId)) if (hub.isOnline(id)) hub.emitToUser(id, 'spotify:presence', forFriends);
}

async function poll(watch: Watch) {
  if (watch.polling) return;
  watch.polling = true;
  try {
    const now = await currentlyPlaying(watch.userId);
    if (watches.get(watch.userId) !== watch) return;
    const changed = now.track?.id !== watch.track?.id || now.isPlaying !== watch.isPlaying;
    watch.track = now.track;
    watch.progressMs = now.progressMs;
    watch.isPlaying = now.isPlaying;
    watch.updatedAt = Date.now();
    watch.nextAt = Date.now() + (now.track ? ACTIVE_MS : IDLE_MS);
    if (changed) broadcast(watch.userId);
  } catch (err) {
    if (watches.get(watch.userId) !== watch) return;
    // 409 é conta desconectada ou token morto: o spotifyApi já apagou a conta, então para de ler.
    if ((err as { status?: number }).status === 409) return spotifyPresence.unwatch(watch.userId);
    watch.nextAt = Date.now() + ERROR_MS;
  } finally {
    watch.polling = false;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const watch of watches.values()) if (watch.nextAt <= now) void poll(watch);
}, TICK_MS).unref();

export const spotifyPresence = {
  /** Começa a acompanhar o Spotify de quem está online e tem conta ligada. */
  watch(userId: number) {
    const account = queries.spotifyAccount.get(userId);
    if (watches.has(userId) || !hub.isOnline(userId) || !account) return;
    if (!account.show_as_status && !account.show_on_profile) return;
    watches.set(userId, {
      userId,
      track: null,
      progressMs: 0,
      isPlaying: false,
      updatedAt: 0,
      nextAt: 0,
      polling: false,
    });
  },

  unwatch(userId: number) {
    if (!watches.delete(userId)) return;
    broadcast(userId);
  },

  /** As chaves do servidor mudaram: todas as contas foram desligadas de uma vez. */
  unwatchAll() {
    for (const userId of [...watches.keys()]) spotifyPresence.unwatch(userId);
  },

  /** Avisa de novo com o estado atual: usado quando a pessoa troca o status (invisível, por exemplo). */
  sync(userId: number) {
    broadcast(userId);
  },

  listeningOf,

  /** Estado de todos os amigos online de quem acabou de conectar, para a tela já abrir certa. */
  snapshotFor(viewerId: number) {
    const list: Array<{ userId: number; listening: Listening | null }> = [];
    for (const id of [viewerId, ...friendIds(viewerId)]) {
      if (id !== viewerId && (hidden(id) || !accountAllowsStatus(id))) continue;
      const listening = listeningOf(id);
      if (listening) list.push({ userId: id, listening });
    }
    return list;
  },
};

setSpotifyActivity((userId): Activity => {
  if (!accountAllowsStatus(userId)) return null;
  const listening = listeningOf(userId);
  if (!listening?.isPlaying) return null;
  return { type: 'spotify', name: listening.track.name, artists: listening.track.artists };
});
