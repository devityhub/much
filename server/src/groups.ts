import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from './auth';
import { hasBlocked, queries, toPublicUser, type GroupMessageKind, type GroupMessageRow, type GroupRow, type UserRow } from './db';
import { HttpError } from './http';
import { areFriends, groupRoomId, hub } from './hub';
import { removeUploadIfUnused, uploadUrl } from './images';
import { presence } from './presence';
import { isStickerUrl } from './stickers';

/** Igual ao Discord: até 10 pessoas por grupo, contando você. */
export const MAX_GROUP_MEMBERS = 10;
const MAX_LENGTH = 2000;
const PAGE_SIZE = 50;
const MAX_PINS = 50;
const SEARCH_LIMIT = 50;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 15;

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: number;
  kind: GroupMessageKind;
  /** Texto, URL da figurinha ou, em avisos do sistema, um JSON com o que aconteceu. */
  content: string;
  callDuration: number | null;
  createdAt: number;
  pinnedAt: number | null;
}

/** Avisos que aparecem no meio da conversa. Os nomes ficam gravados para o aviso continuar certo se a pessoa sair. */
type SystemEvent =
  | { type: 'create'; names: string[] }
  | { type: 'add'; names: string[] }
  | { type: 'remove'; names: string[] }
  | { type: 'leave' }
  | { type: 'rename'; name: string }
  | { type: 'icon' }
  | { type: 'owner'; name: string };

export function toGroupMessage(row: GroupMessageRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    kind: row.kind,
    content: row.content,
    callDuration: row.call_duration,
    createdAt: row.created_at,
    pinnedAt: row.pinned_at ?? null,
  };
}

const nameOf = (row: Pick<UserRow, 'nick' | 'display_name'>) => row.display_name || row.nick;

export const groupMemberIds = (groupId: number) => queries.groupMemberIds.all(groupId).map((r) => r.user_id);

export const isGroupMember = (groupId: number, userId: number) => Boolean(queries.groupMembership.get(groupId, userId));

/** Nome que aparece quando o grupo não tem nome: os primeiros membros. */
export function groupTitle(groupId: number) {
  const group = queries.groupById.get(groupId);
  if (!group) return 'Grupo';
  if (group.name) return group.name;
  return queries.groupMembers.all(groupId).slice(0, 3).map(nameOf).join(', ');
}

function notifyGroupsChanged(userIds: Iterable<number>) {
  for (const id of new Set(userIds)) hub.emitToUser(id, 'groups:changed');
}

/** Lista e conversa dos membros se atualizam quando alguém entra ou sai da chamada do grupo. */
export function notifyGroupCallChanged(groupId: number) {
  notifyGroupsChanged(groupMemberIds(groupId));
}

export function postGroupMessage(groupId: number, senderId: number, kind: GroupMessageKind, content: string, callDuration: number | null = null) {
  const { lastInsertRowid } = queries.insertGroupMessage.run(groupId, senderId, kind, content, callDuration, Date.now());
  const message = toGroupMessage(queries.groupMessageById.get(Number(lastInsertRowid))!);
  for (const id of groupMemberIds(groupId)) hub.emitToUser(id, 'group:message', message);
  return message;
}

const systemMessage = (groupId: number, actorId: number, event: SystemEvent) => postGroupMessage(groupId, actorId, 'system', JSON.stringify(event));

function summaryOf(group: GroupRow, unread: number, lastId: number | null) {
  const last = lastId ? queries.groupMessageById.get(lastId) : undefined;
  return {
    id: group.id,
    name: group.name,
    iconImage: group.icon_image,
    ownerId: group.owner_id,
    createdAt: group.created_at,
    members: queries.groupMembers.all(group.id).map(toPublicUser),
    lastMessage: last ? toGroupMessage(last) : null,
    unread,
    /** Quem está na chamada do grupo agora. */
    callMembers: [...new Set(presence.participants(groupRoomId(group.id)).map((p) => p.user.id))],
  };
}

function summaryFor(groupId: number, userId: number) {
  const row = queries.groupsOf.all({ me: userId }).find((g) => g.id === groupId);
  if (!row) throw new HttpError(404, 'Grupo não encontrado');
  return summaryOf(row, row.unread, row.last_id);
}

/** Quem escreveu nessas mensagens e já saiu do grupo: o app ainda precisa do nome e da foto. */
function formerMembers(groupId: number, messages: GroupMessage[]) {
  const current = new Set(groupMemberIds(groupId));
  const ids = new Set(messages.map((m) => m.senderId).filter((id) => !current.has(id)));
  return [...ids].flatMap((id) => {
    const row = queries.userById.get(id);
    return row ? [toPublicUser(row)] : [];
  });
}

function memberGroup(param: string, userId: number) {
  const id = Number(param);
  const group = Number.isInteger(id) && id > 0 ? queries.groupById.get(id) : undefined;
  if (!group || !isGroupMember(group.id, userId)) throw new HttpError(404, 'Grupo não encontrado');
  return group;
}

/** Só entra quem é amigo de quem está adicionando, e ninguém bloqueado de nenhum dos lados. */
function addableFriends(me: number, userIds: number[]) {
  const rows: UserRow[] = [];
  for (const id of new Set(userIds)) {
    if (id === me) continue;
    const row = queries.userById.get(id);
    if (!row) throw new HttpError(404, 'Usuário não encontrado');
    if (!areFriends(me, id) || hasBlocked(me, id) || hasBlocked(id, me)) {
      throw new HttpError(403, `Você só pode adicionar amigos (${nameOf(row)} não é seu amigo)`);
    }
    rows.push(row);
  }
  return rows;
}

const idsSchema = z.array(z.number().int().positive()).min(1, 'Escolha pelo menos um amigo').max(MAX_GROUP_MEMBERS);
const createSchema = z.object({ userIds: idsSchema });
const addSchema = z.object({ userIds: idsSchema });
const updateSchema = z.object({
  name: z.string().trim().max(60, 'O nome pode ter no máximo 60 caracteres').optional(),
  iconImage: uploadUrl.optional(),
});
const sendSchema = z
  .object({
    kind: z.enum(['text', 'sticker']).default('text'),
    content: z
      .string({ required_error: 'Escreva uma mensagem' })
      .trim()
      .min(1, 'Escreva uma mensagem')
      .max(MAX_LENGTH, `Mensagens têm no máximo ${MAX_LENGTH} caracteres`),
  })
  .refine((body) => body.kind !== 'sticker' || isStickerUrl(body.content), { message: 'Figurinha inválida', path: ['content'] });
const pageSchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const readSchema = z.object({ lastId: z.number().int().nonnegative() });
const searchSchema = z.object({
  q: z.string({ required_error: 'Digite o que procurar' }).trim().min(1, 'Digite o que procurar').max(100),
});

const recent = new Map<number, number[]>();

/** `removeFromCall` tira da chamada do grupo quem foi expulso ou saiu. */
export function createGroupsRouter(removeFromCall: (roomId: string, userId: number) => void) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    const me = currentUser(res);
    const groups = queries.groupsOf
      .all({ me: me.id })
      .map((row) => summaryOf(row, row.unread, row.last_id))
      .sort((a, b) => (b.lastMessage?.createdAt ?? b.createdAt) - (a.lastMessage?.createdAt ?? a.createdAt));
    res.json({ groups });
  });

  router.post('/', (req, res) => {
    const me = currentUser(res);
    const friends = addableFriends(me.id, createSchema.parse(req.body).userIds);
    if (friends.length < 2) throw new HttpError(400, 'Um grupo precisa de pelo menos 3 pessoas. Para falar com uma só, use a DM');
    if (friends.length + 1 > MAX_GROUP_MEMBERS) throw new HttpError(400, `Um grupo tem no máximo ${MAX_GROUP_MEMBERS} pessoas`);
    const now = Date.now();
    const { lastInsertRowid } = queries.insertGroup.run('', me.id, now);
    const groupId = Number(lastInsertRowid);
    queries.addGroupMember.run(groupId, me.id, now);
    for (const friend of friends) queries.addGroupMember.run(groupId, friend.id, now);
    systemMessage(groupId, me.id, { type: 'create', names: friends.map(nameOf) });
    notifyGroupsChanged(groupMemberIds(groupId));
    res.status(201).json({ group: summaryFor(groupId, me.id) });
  });

  router.get('/:id', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    res.json({ group: summaryFor(group.id, me.id) });
  });

  router.patch('/:id', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const data = updateSchema.parse(req.body);
    const name = data.name ?? group.name;
    const icon = data.iconImage !== undefined ? data.iconImage : group.icon_image;
    queries.updateGroup.run(name, icon, group.id);
    if (name !== group.name) systemMessage(group.id, me.id, { type: 'rename', name });
    if (icon !== group.icon_image) {
      systemMessage(group.id, me.id, { type: 'icon' });
      removeUploadIfUnused(group.icon_image);
    }
    notifyGroupsChanged(groupMemberIds(group.id));
    res.json({ group: summaryFor(group.id, me.id) });
  });

  router.post('/:id/members', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const current = new Set(groupMemberIds(group.id));
    const fresh = addableFriends(me.id, addSchema.parse(req.body).userIds).filter((u) => !current.has(u.id));
    if (!fresh.length) throw new HttpError(400, 'Essas pessoas já estão no grupo');
    if (current.size + fresh.length > MAX_GROUP_MEMBERS) {
      throw new HttpError(400, `O grupo só tem espaço para mais ${MAX_GROUP_MEMBERS - current.size} pessoa(s)`);
    }
    const now = Date.now();
    for (const user of fresh) queries.addGroupMember.run(group.id, user.id, now);
    systemMessage(group.id, me.id, { type: 'add', names: fresh.map(nameOf) });
    notifyGroupsChanged(groupMemberIds(group.id));
    res.json({ group: summaryFor(group.id, me.id) });
  });

  /** Sair do grupo (o próprio id) ou expulsar alguém (só o dono). */
  router.delete('/:id/members/:userId', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const target = Number(req.params.userId);
    const leaving = target === me.id;
    if (!leaving && group.owner_id !== me.id) throw new HttpError(403, 'Só o dono do grupo pode remover pessoas');
    const targetRow = queries.userById.get(target);
    if (!targetRow || !isGroupMember(group.id, target)) throw new HttpError(404, 'Essa pessoa não está no grupo');

    const before = groupMemberIds(group.id);
    // O aviso sai antes de remover, para quem está saindo também receber.
    systemMessage(group.id, me.id, leaving ? { type: 'leave' } : { type: 'remove', names: [nameOf(targetRow)] });
    queries.removeGroupMember.run(group.id, target);
    removeFromCall(groupRoomId(group.id), target);

    const remaining = groupMemberIds(group.id);
    if (!remaining.length) {
      queries.deleteGroup.run(group.id);
      removeUploadIfUnused(group.icon_image);
    } else if (group.owner_id === target) {
      const heir = queries.userById.get(remaining[0])!;
      queries.setGroupOwner.run(heir.id, group.id);
      systemMessage(group.id, heir.id, { type: 'owner', name: nameOf(heir) });
    }
    notifyGroupsChanged(before);
    res.status(204).end();
  });

  router.get('/:id/messages', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const { before, limit = PAGE_SIZE } = pageSchema.parse(req.query);
    const rows = queries.groupPage.all(group.id, before ?? Number.MAX_SAFE_INTEGER, limit + 1);
    const messages = rows.slice(0, limit).reverse().map(toGroupMessage);
    res.json({ messages, hasMore: rows.length > limit, formerMembers: formerMembers(group.id, messages) });
  });

  router.post('/:id/messages', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const { kind, content } = sendSchema.parse(req.body);
    const now = Date.now();
    const times = (recent.get(me.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX) throw new HttpError(429, 'Calma! Você está mandando mensagens rápido demais');
    times.push(now);
    recent.set(me.id, times);
    const message = postGroupMessage(group.id, me.id, kind, content);
    queries.markGroupRead.run(message.id, group.id, me.id);
    res.status(201).json(message);
  });

  function messageOf(group: GroupRow, param: string) {
    const row = queries.groupMessageById.get(Number(param));
    if (!row || row.group_id !== group.id) throw new HttpError(404, 'Mensagem não encontrada');
    return row;
  }

  router.delete('/:id/messages/:mid', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const row = messageOf(group, req.params.mid);
    if (row.sender_id !== me.id || row.kind === 'system' || row.kind === 'call') throw new HttpError(403, 'Você só pode apagar suas mensagens');
    queries.deleteGroupMessage.run(row.id);
    for (const id of groupMemberIds(group.id)) hub.emitToUser(id, 'group:deleted', { groupId: group.id, id: row.id });
    res.status(204).end();
  });

  router.get('/:id/pins', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const messages = queries.groupPins.all(group.id).map(toGroupMessage);
    res.json({ messages, formerMembers: formerMembers(group.id, messages) });
  });

  function setPinned(req: Request, res: Response, pinned: boolean) {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const row = messageOf(group, req.params.mid);
    if (row.kind === 'system' || row.kind === 'call') throw new HttpError(400, 'Essa mensagem não pode ser fixada');
    if (pinned && !row.pinned_at && (queries.countGroupPins.get(group.id)?.count ?? 0) >= MAX_PINS) {
      throw new HttpError(400, `Dá para fixar no máximo ${MAX_PINS} mensagens por conversa`);
    }
    const pinnedAt = pinned ? (row.pinned_at ?? Date.now()) : null;
    queries.setGroupPinned.run(pinnedAt, row.id);
    for (const id of groupMemberIds(group.id)) hub.emitToUser(id, 'group:pinned', { groupId: group.id, id: row.id, pinnedAt });
    res.json(toGroupMessage(queries.groupMessageById.get(row.id)!));
  }

  router.put('/:id/messages/:mid/pin', (req, res) => setPinned(req, res, true));
  router.delete('/:id/messages/:mid/pin', (req, res) => setPinned(req, res, false));

  router.get('/:id/search', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const q = searchSchema.parse(req.query).q;
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const messages = queries.searchGroup.all(group.id, pattern, SEARCH_LIMIT).map(toGroupMessage);
    res.json({ messages, formerMembers: formerMembers(group.id, messages) });
  });

  router.post('/:id/read', (req, res) => {
    const me = currentUser(res);
    const group = memberGroup(req.params.id, me.id);
    const { lastId } = readSchema.parse(req.body);
    queries.markGroupRead.run(lastId, group.id, me.id);
    hub.emitToUser(me.id, 'group:read', { groupId: group.id, lastId });
    res.status(204).end();
  });

  return router;
}
