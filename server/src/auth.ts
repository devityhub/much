import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from './config';
import { AVATARS, COVERS, PRESENCES, queries, toPublicUser, toSelfUser, type PublicUser } from './db';
import { asyncHandler, HttpError } from './http';
import { hub } from './hub';
import { removeUploadIfUnused, uploadUrl } from './images';
import { music } from './music';
import { presence } from './presence';
import { spotifyPresence } from './spotifyPresence';

const registerSchema = z.object({
  nick: z
    .string({ required_error: 'Informe um nick' })
    .trim()
    .min(3, 'O nick precisa ter pelo menos 3 caracteres')
    .max(20, 'O nick pode ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Use apenas letras, números, ponto, hífen e underline no nick'),
  email: z.string({ required_error: 'Informe um email' }).trim().email('Email inválido').max(120),
  password: z
    .string({ required_error: 'Informe uma senha' })
    .min(6, 'A senha precisa ter pelo menos 6 caracteres')
    .max(100, 'Senha muito longa'),
  avatar: z.enum(AVATARS).optional(),
});

const loginSchema = z.object({
  login: z.string({ required_error: 'Informe seu nick ou email' }).trim().min(1, 'Informe seu nick ou email'),
  password: z.string({ required_error: 'Informe sua senha' }).min(1, 'Informe sua senha'),
});

const updateSchema = z.object({
  avatar: z.enum(AVATARS, { errorMap: () => ({ message: 'Avatar inválido' }) }).optional(),
  displayName: z.string().trim().max(32, 'O nome de exibição pode ter no máximo 32 caracteres').optional(),
  bio: z.string().max(190, 'O "sobre mim" pode ter no máximo 190 caracteres').optional(),
  pronouns: z.string().trim().max(30, 'Os pronomes podem ter no máximo 30 caracteres').optional(),
  banner: z.enum(COVERS, { errorMap: () => ({ message: 'Banner inválido' }) }).optional(),
  customStatus: z.string().trim().max(60, 'O status pode ter no máximo 60 caracteres').optional(),
  presence: z.enum(PRESENCES, { errorMap: () => ({ message: 'Status inválido' }) }).optional(),
  avatarImage: uploadUrl.optional(),
  bannerImage: uploadUrl.optional(),
});

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: '7d' });
}

export function userFromToken(token: unknown): PublicUser | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) return null;
    const row = queries.userById.get(Number(payload.sub));
    return row ? toPublicUser(row) : null;
  } catch {
    return null;
  }
}

export function currentUser(res: Response): PublicUser {
  return res.locals.user as PublicUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sessão expirada, entre novamente' });
    return;
  }
  res.locals.user = user;
  next();
}

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = queries.userByNickOrEmail.get(data.nick, data.email);
    if (existing) {
      const nickTaken = existing.nick.toLowerCase() === data.nick.toLowerCase();
      throw new HttpError(409, nickTaken ? 'Esse nick já está em uso' : 'Esse email já está cadastrado');
    }
    const hash = await bcrypt.hash(data.password, 10);
    const avatar = data.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const result = queries.insertUser.run(data.nick, data.email, hash, avatar);
    const user = queries.userById.get(Number(result.lastInsertRowid))!;
    res.status(201).json({ token: signToken(user.id), user: toSelfUser(user) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = queries.userByLogin.get(data.login, data.login);
    const ok = user ? await bcrypt.compare(data.password, user.password_hash) : false;
    if (!user || !ok) throw new HttpError(401, 'Nick/email ou senha incorretos');
    res.json({ token: signToken(user.id), user: toSelfUser(user) });
  }),
);

authRouter.get('/me', requireAuth, (_req, res) => {
  const row = queries.userById.get(currentUser(res).id)!;
  res.json({ user: toSelfUser(row) });
});

authRouter.patch('/me', requireAuth, (req, res) => {
  const data = updateSchema.parse(req.body);
  const row = queries.userById.get(currentUser(res).id)!;
  const next = {
    avatar: data.avatar ?? row.avatar,
    displayName: data.displayName !== undefined ? data.displayName || null : row.display_name,
    bio: data.bio !== undefined ? data.bio.trim() : row.bio,
    pronouns: data.pronouns ?? row.pronouns,
    banner: data.banner ?? row.banner,
    customStatus: data.customStatus ?? row.custom_status,
    presence: data.presence ?? row.presence,
    avatarImage: data.avatarImage !== undefined ? data.avatarImage : row.avatar_image,
    bannerImage: data.bannerImage !== undefined ? data.bannerImage : row.banner_image,
  };
  queries.updateProfile.run(
    next.avatar,
    next.displayName,
    next.bio,
    next.pronouns,
    next.banner,
    next.customStatus,
    next.presence,
    next.avatarImage,
    next.bannerImage,
    row.id,
  );
  if (next.avatarImage !== row.avatar_image) removeUploadIfUnused(row.avatar_image);
  if (next.bannerImage !== row.banner_image) removeUploadIfUnused(row.banner_image);
  const updated = toPublicUser(queries.userById.get(row.id)!);
  hub.refreshUser(updated);
  music.updateUser(updated);
  if (presence.updateUser(updated)) hub.notifyRoomsChanged();
  hub.notifyFriendsChanged(row.id);
  // Ficar invisível tem que apagar a música na tela dos amigos na hora.
  if (next.presence !== row.presence) spotifyPresence.sync(row.id);
  res.json({ user: toSelfUser(queries.userById.get(row.id)!) });
});
