import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAuth } from './auth';
import { queries, type StickerRow } from './db';
import { HttpError } from './http';
import { removeUploadIfUnused, UPLOAD_URL_PATTERN } from './images';

const MAX_PER_USER = 60;

/** Pacote que já vem com o Much (arquivos em client/public/stickers). */
export const BUILTIN_STICKERS = [
  'amor',
  'risada',
  'choro',
  'uau',
  'raiva',
  'sono',
  'piscada',
  'legal',
  'festa',
  'pensando',
  'coracao',
  'estrela',
] as const;

const BUILTIN_PATTERN = /^\/stickers\/([a-z0-9-]+)\.svg$/;

/** Aceita figurinha do pacote do Much ou imagem enviada pelo próprio usuário. */
export function isStickerUrl(url: string) {
  if (UPLOAD_URL_PATTERN.test(url)) return true;
  const match = BUILTIN_PATTERN.exec(url);
  return Boolean(match && (BUILTIN_STICKERS as readonly string[]).includes(match[1]));
}

export interface Sticker {
  id: number;
  url: string;
  name: string;
}

const toSticker = (row: StickerRow): Sticker => ({ id: row.id, url: row.url, name: row.name });

const createSchema = z.object({
  url: z.string().regex(UPLOAD_URL_PATTERN, 'Imagem inválida'),
  name: z.string().trim().max(40).optional(),
});

export const stickersRouter = Router();
stickersRouter.use(requireAuth);

stickersRouter.get('/', (_req, res) => {
  const me = currentUser(res);
  res.json({ stickers: queries.stickersOf.all(me.id).map(toSticker) });
});

stickersRouter.post('/', (req, res) => {
  const me = currentUser(res);
  const { url, name = '' } = createSchema.parse(req.body);
  if (queries.countStickers.get(me.id)!.count >= MAX_PER_USER) {
    throw new HttpError(400, `Você pode guardar até ${MAX_PER_USER} figurinhas. Apague alguma para enviar outra`);
  }
  const { lastInsertRowid } = queries.insertSticker.run(me.id, url, name, Date.now());
  res.status(201).json(toSticker(queries.stickerById.get(Number(lastInsertRowid))!));
});

stickersRouter.delete('/:id', (req, res) => {
  const me = currentUser(res);
  const row = queries.stickerById.get(Number(req.params.id));
  if (!row || row.user_id !== me.id) throw new HttpError(404, 'Figurinha não encontrada');
  queries.deleteSticker.run(row.id);
  // A imagem fica se alguma mensagem já enviada ainda usa ela.
  removeUploadIfUnused(row.url);
  res.status(204).end();
});
