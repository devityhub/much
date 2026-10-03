import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from './auth';
import { hasBlocked, queries, toPublicUser, type DmKind, type DmRow } from './db';
import { HttpError } from './http';
import { areFriends, hub } from './hub';
import { isStickerUrl } from './stickers';

/** Pedido pendente: destinatário ainda não aceitou conversar com quem não é amigo. */
function isPendingRequest(me: number, other: number) {
  return queries.dmRequestState.get(me, other)?.status === 'pending';
}

function canMessage(me: number, other: number) {
  if (areFriends(me, other)) return true;
  const theirs = queries.dmRequestState.get(other, me)?.status;
  const mine = queries.dmRequestState.get(me, other)?.status;
  // Já aceitou o pedido, ou eu iniciei a conversa (ainda aguardando o outro).
  if (mine === 'accepted' || theirs === 'accepted') return true;
  if (mine === 'ignored') return false;
  return true;
}

function ensureMessageRequest(senderId: number, recipientId: number) {
  if (areFriends(senderId, recipientId)) {
    queries.deleteDmRequest.run(recipientId, senderId);
    queries.deleteDmRequest.run(senderId, recipientId);
    return;
  }
  const current = queries.dmRequestState.get(recipientId, senderId)?.status;
  if (current === 'accepted') return;
  // Ignorado volta a pendente se a pessoa mandar de novo.
  queries.upsertDmRequest.run(recipientId, senderId, 'pending', Date.now());
}

const MAX_LENGTH = 2000;
const PAGE_SIZE = 50;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 15;

export interface DmMessage {
  id: number;
  senderId: number;
  recipientId: number;
  kind: DmKind;
  /** Texto da mensagem ou, em figurinhas, a URL da imagem. */
  content: string;
  /** Só em chamadas: segundos de conversa, ou null quando ninguém atendeu. */
  callDuration: number | null;
  createdAt: number;
  pinnedAt: number | null;
}

const MAX_PINS = 50;
const SEARCH_LIMIT = 50;

const pairOf = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);

export function toDmMessage(row: DmRow): DmMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.sender_id === row.user_a ? row.user_b : row.user_a,
    kind: row.kind,
    content: row.content,
    callDuration: row.call_duration,
    createdAt: row.created_at,
    pinnedAt: row.pinned_at ?? null,
  };
}

/** Grava a mensagem e entrega na hora para as abas abertas dos dois lados. Quem está offline recebe ao abrir o Much. */
export function postDm(senderId: number, recipientId: number, kind: DmMessage['kind'], content: string, callDuration: number | null = null) {
  const [a, b] = pairOf(senderId, recipientId);
  const { lastInsertRowid } = queries.insertDm.run(a, b, senderId, kind, content, callDuration, Date.now());
  const message = toDmMessage(queries.dmById.get(Number(lastInsertRowid))!);
  hub.emitToUser(senderId, 'dm:message', message);
  hub.emitToUser(recipientId, 'dm:message', message);
  return message;
}

const sendSchema = z
  .object({
    kind: z.enum(['text', 'sticker']).default('text'),
    content: z
      .string({ required_error: 'Escreva uma mensagem' })
      .trim()
      .min(1, 'Escreva uma mensagem')
      .max(MAX_LENGTH, `Mensagens têm no máximo ${MAX_LENGTH} caracteres`),
  })
  .refine((body) => body.kind !== 'sticker' || isStickerUrl(body.content), {
    message: 'Figurinha inválida',
    path: ['content'],
  });
const readSchema = z.object({ lastId: z.number().int().nonnegative() });
const searchSchema = z.object({
  q: z.string({ required_error: 'Digite o que procurar' }).trim().min(1, 'Digite o que procurar').max(100),
});
const pageSchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function otherOf(param: string) {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0 || !queries.userById.get(id)) throw new HttpError(404, 'Usuário não encontrado');
  return id;
}

const recent = new Map<number, number[]>();

export const dmsRouter = Router();
dmsRouter.use(requireAuth);

dmsRouter.get('/', (_req, res) => {
  const me = currentUser(res);
  const conversations = queries.dmConversations
    .all({ me: me.id })
    .map((row) => {
      const lastMessage = toDmMessage(row);
      return {
        userId: lastMessage.senderId === me.id ? lastMessage.recipientId : lastMessage.senderId,
        lastMessage,
        unread: row.unread,
      };
    })
    // Solicitações pendentes ficam na inbox própria, não nas MDs.
    .filter((c) => !isPendingRequest(me.id, c.userId));
  res.json({ conversations });
});

dmsRouter.get('/requests', (_req, res) => {
  const me = currentUser(res);
  const requests = queries.dmMessageRequests.all({ me: me.id }).map((row) => {
    const lastMessage = toDmMessage(row);
    const userId = lastMessage.senderId === me.id ? lastMessage.recipientId : lastMessage.senderId;
    const user = queries.userById.get(userId);
    return {
      userId,
      user: user ? toPublicUser(user) : { id: userId, nick: 'desconhecido', avatar: 'red', avatarImage: null, displayName: null, bio: '', pronouns: '', banner: 'cover-1', bannerImage: null, customStatus: '', createdAt: null },
      lastMessage,
      unread: row.unread,
    };
  });
  res.json({ requests });
});

dmsRouter.post('/:userId/accept-request', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  if (!isPendingRequest(me.id, other)) throw new HttpError(404, 'Solicitação não encontrada');
  queries.upsertDmRequest.run(me.id, other, 'accepted', Date.now());
  hub.emitToUser(me.id, 'dm:requests-changed');
  hub.emitToUser(other, 'dm:requests-changed');
  hub.emitToUser(me.id, 'dm:conversations-changed');
  hub.emitToUser(other, 'dm:conversations-changed');
  res.json({ ok: true });
});

dmsRouter.post('/:userId/ignore-request', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  if (!isPendingRequest(me.id, other)) throw new HttpError(404, 'Solicitação não encontrada');
  const [a, b] = pairOf(me.id, other);
  queries.deleteDmPair.run(a, b);
  queries.deleteDmReadsPair.run(me.id, other, other, me.id);
  queries.upsertDmRequest.run(me.id, other, 'ignored', Date.now());
  hub.emitToUser(me.id, 'dm:requests-changed');
  hub.emitToUser(other, 'dm:requests-changed');
  hub.emitToUser(me.id, 'dm:conversations-changed');
  hub.emitToUser(other, 'dm:conversations-changed');
  hub.emitToUser(me.id, 'dm:thread-cleared', { userId: other });
  hub.emitToUser(other, 'dm:thread-cleared', { userId: me.id });
  res.status(204).end();
});

dmsRouter.get('/:userId/messages', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  const { before, limit = PAGE_SIZE } = pageSchema.parse(req.query);
  const [a, b] = pairOf(me.id, other);
  const rows = queries.dmPage.all(a, b, before ?? Number.MAX_SAFE_INTEGER, limit + 1);
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(toDmMessage);
  res.json({ messages, hasMore });
});

dmsRouter.post('/:userId/messages', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  if (other === me.id) throw new HttpError(400, 'Você não pode mandar mensagem para si mesmo');
  if (hasBlocked(me.id, other)) throw new HttpError(403, 'Você bloqueou esta pessoa. Desbloqueie para mandar mensagens');
  if (hasBlocked(other, me.id)) throw new HttpError(403, 'Não foi possível enviar a mensagem');
  if (!canMessage(me.id, other)) throw new HttpError(403, 'Esta pessoa não quer receber suas mensagens');
  const { kind, content } = sendSchema.parse(req.body);

  const now = Date.now();
  const times = (recent.get(me.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) throw new HttpError(429, 'Calma! Você está mandando mensagens rápido demais');
  times.push(now);
  recent.set(me.id, times);

  ensureMessageRequest(me.id, other);
  const message = postDm(me.id, other, kind, content);
  queries.markDmRead.run(me.id, other, message.id);
  if (!areFriends(me.id, other)) {
    hub.emitToUser(other, 'dm:requests-changed');
  }
  res.status(201).json(message);
});

dmsRouter.delete('/:userId/messages/:id', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  const row = queries.dmById.get(Number(req.params.id));
  const [a, b] = pairOf(me.id, other);
  if (!row || row.user_a !== a || row.user_b !== b) throw new HttpError(404, 'Mensagem não encontrada');
  if (row.sender_id !== me.id || row.kind === 'call') throw new HttpError(403, 'Você só pode apagar suas mensagens');
  queries.deleteDm.run(row.id);
  hub.emitToUser(me.id, 'dm:deleted', { userId: other, id: row.id });
  hub.emitToUser(other, 'dm:deleted', { userId: me.id, id: row.id });
  res.status(204).end();
});

dmsRouter.get('/:userId/pins', (req, res) => {
  const me = currentUser(res);
  const [a, b] = pairOf(me.id, otherOf(req.params.userId));
  res.json({ messages: queries.dmPins.all(a, b).map(toDmMessage) });
});

/** Qualquer um dos dois fixa ou desafixa, como nas DMs do Discord. */
function setPinned(req: Request, res: Response, pinned: boolean) {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  const row = queries.dmById.get(Number(req.params.id));
  const [a, b] = pairOf(me.id, other);
  if (!row || row.user_a !== a || row.user_b !== b) throw new HttpError(404, 'Mensagem não encontrada');
  if (row.kind === 'call') throw new HttpError(400, 'Chamadas não podem ser fixadas');
  if (pinned && !row.pinned_at && (queries.countDmPins.get(a, b)?.count ?? 0) >= MAX_PINS) {
    throw new HttpError(400, `Dá para fixar no máximo ${MAX_PINS} mensagens por conversa`);
  }
  const pinnedAt = pinned ? (row.pinned_at ?? Date.now()) : null;
  queries.setDmPinned.run(pinnedAt, row.id);
  hub.emitToUser(me.id, 'dm:pinned', { userId: other, id: row.id, pinnedAt });
  hub.emitToUser(other, 'dm:pinned', { userId: me.id, id: row.id, pinnedAt });
  res.json(toDmMessage(queries.dmById.get(row.id)!));
}

dmsRouter.put('/:userId/messages/:id/pin', (req, res) => setPinned(req, res, true));
dmsRouter.delete('/:userId/messages/:id/pin', (req, res) => setPinned(req, res, false));

dmsRouter.get('/:userId/search', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  const q = searchSchema.parse(req.query).q;
  const [a, b] = pairOf(me.id, other);
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  res.json({ messages: queries.searchDms.all(a, b, pattern, SEARCH_LIMIT).map(toDmMessage) });
});

dmsRouter.post('/:userId/read', (req, res) => {
  const me = currentUser(res);
  const other = otherOf(req.params.userId);
  const { lastId } = readSchema.parse(req.body);
  queries.markDmRead.run(me.id, other, lastId);
  hub.emitToUser(me.id, 'dm:read', { userId: other, lastId });
  res.status(204).end();
});
