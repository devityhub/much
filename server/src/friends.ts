import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from './auth';
import { hasBlocked, queries, toPublicUser } from './db';
import { HttpError } from './http';
import { activityOf, hub } from './hub';

const requestSchema = z.object({
  nick: z.string({ required_error: 'Informe o nick do amigo' }).trim().min(1, 'Informe o nick do amigo').max(20),
});

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.get('/', (_req, res) => {
  const me = currentUser(res);
  const rows = queries.friendshipsOf.all(me.id, me.id, me.id);
  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const row of rows) {
    const user = toPublicUser({
      id: row.other_id,
      nick: row.other_nick,
      avatar: row.other_avatar,
      display_name: row.other_display_name,
      bio: row.other_bio,
      pronouns: row.other_pronouns,
      banner: row.other_banner,
      custom_status: row.other_custom_status,
      created_at: row.other_created_at,
      avatar_image: row.other_avatar_image,
      banner_image: row.other_banner_image,
    });
    if (row.status === 'accepted') {
      const online = hub.isOnline(user.id) && row.other_presence !== 'invisible';
      const presence = online ? row.other_presence : 'offline';
      friends.push({ id: row.id, user, online, presence, activity: online ? activityOf(user.id) : null, since: row.created_at });
    } else if (row.addressee_id === me.id) {
      incoming.push({ id: row.id, user, createdAt: row.created_at });
    } else {
      outgoing.push({ id: row.id, user, createdAt: row.created_at });
    }
  }
  const blocked = queries.blockedUsers.all(me.id).map(toPublicUser);
  res.json({ friends, incoming, outgoing, blocked });
});

friendsRouter.post('/requests', (req, res) => {
  const me = currentUser(res);
  const { nick } = requestSchema.parse(req.body);
  const target = queries.userByNick.get(nick);
  if (!target) throw new HttpError(404, `Ninguém com o nick "${nick}" foi encontrado`);
  if (target.id === me.id) throw new HttpError(400, 'Você não pode adicionar a si mesmo');
  if (hasBlocked(me.id, target.id)) throw new HttpError(400, `Você bloqueou ${target.nick}. Desbloqueie para enviar um pedido`);
  if (hasBlocked(target.id, me.id)) throw new HttpError(403, `Não foi possível enviar o pedido de amizade para ${target.nick}`);

  const existing = queries.friendshipBetween.get(me.id, target.id, target.id, me.id);
  if (existing?.status === 'accepted') throw new HttpError(409, `Você e ${target.nick} já são amigos`);
  if (existing && existing.requester_id === me.id) throw new HttpError(409, 'Pedido já enviado, aguarde a resposta');

  if (existing) {
    queries.acceptFriendship.run(existing.id);
    queries.deleteDmRequest.run(me.id, target.id);
    queries.deleteDmRequest.run(target.id, me.id);
    hub.notifyFriendsChanged(me.id);
    hub.emitToUser(target.id, 'friends:changed');
    hub.emitToUser(me.id, 'dm:requests-changed');
    hub.emitToUser(target.id, 'dm:requests-changed');
    hub.emitToUser(me.id, 'dm:conversations-changed');
    hub.emitToUser(target.id, 'dm:conversations-changed');
    res.json({ status: 'accepted', user: toPublicUser(target) });
    return;
  }

  queries.insertFriendship.run(me.id, target.id);
  hub.emitToUser(target.id, 'friends:request', { from: me });
  hub.emitToUser(target.id, 'friends:changed');
  hub.emitToUser(me.id, 'friends:changed');
  res.status(201).json({ status: 'pending', user: toPublicUser(target) });
});

friendsRouter.post('/requests/:id/accept', (req, res) => {
  const me = currentUser(res);
  const row = queries.friendshipById.get(Number(req.params.id));
  if (!row || row.status !== 'pending' || row.addressee_id !== me.id) throw new HttpError(404, 'Pedido não encontrado');
  queries.acceptFriendship.run(row.id);
  queries.deleteDmRequest.run(me.id, row.requester_id);
  queries.deleteDmRequest.run(row.requester_id, me.id);
  hub.notifyFriendsChanged(me.id);
  hub.emitToUser(row.requester_id, 'friends:accepted', { by: me });
  hub.emitToUser(me.id, 'dm:requests-changed');
  hub.emitToUser(row.requester_id, 'dm:requests-changed');
  hub.emitToUser(me.id, 'dm:conversations-changed');
  hub.emitToUser(row.requester_id, 'dm:conversations-changed');
  res.json({ ok: true });
});

friendsRouter.delete('/requests/:id', (req, res) => {
  const me = currentUser(res);
  const row = queries.friendshipById.get(Number(req.params.id));
  if (!row || row.status !== 'pending' || (row.addressee_id !== me.id && row.requester_id !== me.id)) {
    throw new HttpError(404, 'Pedido não encontrado');
  }
  queries.deleteFriendship.run(row.id);
  hub.emitToUser(row.requester_id, 'friends:changed');
  hub.emitToUser(row.addressee_id, 'friends:changed');
  res.status(204).end();
});

friendsRouter.delete('/:userId', (req, res) => {
  const me = currentUser(res);
  const otherId = Number(req.params.userId);
  const row = queries.friendshipBetween.get(me.id, otherId, otherId, me.id);
  if (!row || row.status !== 'accepted') throw new HttpError(404, 'Amizade não encontrada');
  queries.deleteFriendship.run(row.id);
  hub.emitToUser(me.id, 'friends:changed');
  hub.emitToUser(otherId, 'friends:changed');
  res.status(204).end();
});
