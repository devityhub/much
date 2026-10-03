import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { config } from './config';
import { currentUser, requireAuth } from './auth';
import { HttpError } from './http';

const MAX_BYTES = 6 * 1024 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 40;

/** Aceita só imagens que conferem pelo conteúdo, não pelo cabeçalho enviado. */
function detectImage(buf: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}

const recent = new Map<number, number[]>();

export const uploadsRouter = Router();

uploadsRouter.post(
  '/',
  requireAuth,
  express.raw({ type: () => true, limit: MAX_BYTES }),
  (req, res) => {
    const user = currentUser(res);
    const now = Date.now();
    const times = (recent.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX) throw new HttpError(429, 'Muitos envios seguidos, espere alguns minutos');

    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'Nenhuma imagem enviada');
    const ext = detectImage(body);
    if (!ext) throw new HttpError(415, 'Formato não suportado. Use PNG, JPG, WEBP ou GIF');

    const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(config.uploadsDir, name), body);
    times.push(now);
    recent.set(user.id, times);
    res.status(201).json({ url: `/uploads/${name}` });
  },
);

export const serveUploads = express.static(config.uploadsDir, {
  maxAge: '30d',
  immutable: true,
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  },
});
