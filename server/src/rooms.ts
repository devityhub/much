import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from './config';
import { currentUser, requireAuth } from './auth';
import { COVERS, queries, type RoomRow } from './db';
import { HttpError } from './http';
import { removeUploadIfUnused, uploadUrl } from './images';
import { presence } from './presence';

const roomName = z
  .string({ required_error: 'Informe um nome para a sala' })
  .trim()
  .min(2, 'O nome precisa ter pelo menos 2 caracteres')
  .max(40, 'O nome pode ter no máximo 40 caracteres');

const roomDescription = z
  .string()
  .trim()
  .max(240, 'A descrição pode ter no máximo 240 caracteres');

const createSchema = z.object({
  name: roomName,
  cover: z.enum(COVERS).optional(),
  coverImage: uploadUrl.optional(),
  iconImage: uploadUrl.optional(),
  description: roomDescription.optional(),
  promoted: z.boolean().optional(),
});

const updateSchema = z.object({
  name: roomName.optional(),
  cover: z.enum(COVERS).optional(),
  coverImage: uploadUrl.optional(),
  iconImage: uploadUrl.optional(),
  description: roomDescription.optional(),
  promoted: z.boolean().optional(),
});

export function serializeRoom(row: RoomRow) {
  return {
    id: row.id,
    name: row.name,
    cover: row.cover,
    coverImage: row.cover_image,
    iconImage: row.icon_image,
    description: row.description ?? '',
    promoted: Boolean(row.promoted),
    createdAt: row.created_at,
    owner: {
      id: row.owner_id,
      nick: row.owner_nick,
      avatar: row.owner_avatar,
      avatarImage: row.owner_avatar_image,
      displayName: row.owner_display_name || null,
    },
    maxParticipants: config.maxPeersPerRoom,
    live: presence.summary(row.id),
  };
}

function ownedRoom(id: string, userId: number) {
  const row = queries.roomById.get(id);
  if (!row) throw new HttpError(404, 'Sala não encontrada');
  if (row.owner_id !== userId) throw new HttpError(403, 'Apenas o dono pode alterar a sala');
  return row;
}

export function createRoomsRouter(onRoomsChanged: () => void, onRoomDeleted: (roomId: string) => void) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (_req, res) => {
    res.json({ rooms: queries.allRooms.all().map(serializeRoom) });
  });

  router.get('/:id', (req, res) => {
    const row = queries.roomById.get(req.params.id);
    if (!row) throw new HttpError(404, 'Sala não encontrada');
    res.json({ room: serializeRoom(row) });
  });

  router.post('/', (req, res) => {
    const data = createSchema.parse(req.body);
    const user = currentUser(res);
    const id = crypto.randomBytes(6).toString('base64url');
    const cover = data.cover ?? COVERS[Math.floor(Math.random() * COVERS.length)];
    // Só uma sala fica divulgada no perfil, então marcar esta apaga a marca das outras.
    if (data.promoted) queries.clearPromotedRooms.run(user.id);
    queries.insertRoom.run(
      id,
      data.name,
      user.id,
      cover,
      data.coverImage ?? null,
      data.iconImage ?? null,
      data.description ?? '',
      data.promoted ? 1 : 0,
    );
    onRoomsChanged();
    res.status(201).json({ room: serializeRoom(queries.roomById.get(id)!) });
  });

  router.patch('/:id', (req, res) => {
    const data = updateSchema.parse(req.body);
    const row = ownedRoom(req.params.id, currentUser(res).id);
    const next = {
      name: data.name ?? row.name,
      cover: data.cover ?? row.cover,
      coverImage: data.coverImage !== undefined ? data.coverImage : row.cover_image,
      iconImage: data.iconImage !== undefined ? data.iconImage : row.icon_image,
      description: data.description ?? row.description ?? '',
      promoted: data.promoted ?? Boolean(row.promoted),
    };
    if (next.promoted) queries.clearPromotedRooms.run(row.owner_id);
    queries.updateRoom.run(next.name, next.cover, next.coverImage, next.iconImage, next.description, next.promoted ? 1 : 0, row.id);
    if (next.coverImage !== row.cover_image) removeUploadIfUnused(row.cover_image);
    if (next.iconImage !== row.icon_image) removeUploadIfUnused(row.icon_image);
    onRoomsChanged();
    res.json({ room: serializeRoom(queries.roomById.get(row.id)!) });
  });

  router.delete('/:id', (req, res) => {
    const row = ownedRoom(req.params.id, currentUser(res).id);
    queries.deleteRoom.run(row.id);
    removeUploadIfUnused(row.cover_image);
    removeUploadIfUnused(row.icon_image);
    onRoomDeleted(row.id);
    res.status(204).end();
  });

  return router;
}
