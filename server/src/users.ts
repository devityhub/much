import { Router } from 'express';
import { currentUser, requireAuth } from './auth';
import { hasBlocked, queries, toPublicUser } from './db';
import { HttpError } from './http';
import { activityOf, hub, roomActivityOf } from './hub';
import { serializeRoom } from './rooms';
import { spotifyPresence } from './spotifyPresence';

export type Relationship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'blocked' | 'none';

/** O painel de perfil mostra os amigos em comum em grade, então vai bem mais que os 5 do popover. */
const MUTUAL_SHOWN = 36;

export const usersRouter = Router();
usersRouter.use(requireAuth);

function targetOf(param: string) {
  const row = queries.userById.get(Number(param));
  if (!row) throw new HttpError(404, 'Usuário não encontrado');
  return row;
}

/** Perfil público de qualquer usuário. Status e atividade só aparecem para amigos. */
usersRouter.get('/:id', (req, res) => {
  const me = currentUser(res);
  const row = targetOf(req.params.id);
  const user = toPublicUser(row);

  let relationship: Relationship = 'none';
  let requestId: number | null = null;
  let since: string | null = null;
  if (row.id === me.id) relationship = 'self';
  else if (hasBlocked(me.id, row.id)) relationship = 'blocked';
  else {
    const friendship = queries.friendshipBetween.get(me.id, row.id, row.id, me.id);
    if (friendship?.status === 'accepted') {
      relationship = 'friend';
      since = friendship.created_at;
    } else if (friendship) {
      relationship = friendship.requester_id === me.id ? 'outgoing' : 'incoming';
      requestId = friendship.id;
    }
  }

  let presence: string | null = null;
  if (relationship === 'friend') presence = hub.isOnline(row.id) && row.presence !== 'invisible' ? row.presence : 'offline';
  else if (relationship === 'self') presence = row.presence === 'invisible' ? 'offline' : row.presence;
  // Vale ver status: amigo online, ou você mesmo (inclusive invisível, que é o seu próprio caso).
  const visible = relationship === 'self' || (presence !== null && presence !== 'offline');
  const activity = visible ? activityOf(row.id) : null;
  const hidden = relationship === 'blocked';

  // Leituras leves e independentes — evita waterfall no handler.
  const mutual = hidden || relationship === 'self' ? [] : queries.mutualFriends.all({ me: me.id, other: row.id });
  const mutualFriends = { total: mutual.length, users: mutual.slice(0, MUTUAL_SHOWN).map(toPublicUser) };
  const friendsCount = hidden ? 0 : (queries.countFriends.get(row.id, row.id)?.count ?? 0);
  const stickersCount = hidden ? 0 : (queries.countStickers.get(row.id)?.count ?? 0);
  const ownedRows = hidden ? [] : queries.roomsOwnedBy.all(row.id);
  const owned = ownedRows.map(serializeRoom);
  const stats = { friends: friendsCount, rooms: owned.length, stickers: stickersCount };

  // A sala do momento e a música só aparecem para quem já pode ver o status da pessoa.
  // A sala vem do roomActivityOf porque a atividade visível pode estar tomada pelo Spotify.
  const room = visible ? roomActivityOf(row.id) : null;
  const liveRoomId = room?.type === 'room' ? room.roomId : null;
  const current = liveRoomId ? queries.roomById.get(liveRoomId) : null;
  // A sala divulgada aparece para todo mundo: é a propaganda que o dono escolheu deixar no perfil.
  const promoted = hidden ? null : queries.promotedRoomOf.get(row.id);
  const rooms = {
    current: current ? serializeRoom(current) : null,
    owned,
    promoted: promoted ? serializeRoom(promoted) : null,
  };

  const spotify = queries.spotifyAccount.get(row.id);
  const listening =
    visible && !hidden && spotify?.show_on_profile ? spotifyPresence.listeningOf(row.id) : null;

  res.json({ user, relationship, requestId, since, presence, activity, mutualFriends, stats, rooms, listening });
});

/** Bloquear desfaz a amizade (ou pedido pendente) e impede novos pedidos e chamadas. */
usersRouter.post('/:id/block', (req, res) => {
  const me = currentUser(res);
  const row = targetOf(req.params.id);
  if (row.id === me.id) throw new HttpError(400, 'Você não pode bloquear a si mesmo');
  const friendship = queries.friendshipBetween.get(me.id, row.id, row.id, me.id);
  if (friendship) queries.deleteFriendship.run(friendship.id);
  queries.insertBlock.run(me.id, row.id);
  hub.emitToUser(me.id, 'friends:changed');
  if (friendship) hub.emitToUser(row.id, 'friends:changed');
  res.json({ ok: true });
});

usersRouter.delete('/:id/block', (req, res) => {
  const me = currentUser(res);
  const row = targetOf(req.params.id);
  queries.deleteBlock.run(me.id, row.id);
  hub.emitToUser(me.id, 'friends:changed');
  res.json({ ok: true });
});
