import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config';
import { queries } from './db';

export const UPLOAD_URL_PATTERN = /^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp|gif)$/;

fs.mkdirSync(config.uploadsDir, { recursive: true });

/** URL de imagem enviada ao PassTime, ou null para remover. */
export const uploadUrl = z.string().regex(UPLOAD_URL_PATTERN, 'Imagem inválida').nullable();

export function removeUploadIfUnused(url: string | null | undefined) {
  if (!url || !UPLOAD_URL_PATTERN.test(url)) return;
  if (queries.uploadReferences.get({ url })!.count > 0) return;
  fs.promises.unlink(path.join(config.uploadsDir, path.basename(url))).catch(() => undefined);
}

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/** Apaga imagens enviadas que ninguém salvou em perfil, sala, figurinha ou mensagem (ex.: recorte descartado). */
async function sweepOrphanUploads() {
  const now = Date.now();
  for (const name of await fs.promises.readdir(config.uploadsDir).catch(() => [] as string[])) {
    const url = `/uploads/${name}`;
    if (!UPLOAD_URL_PATTERN.test(url)) continue;
    const stat = await fs.promises.stat(path.join(config.uploadsDir, name)).catch(() => null);
    if (!stat || now - stat.mtimeMs < ORPHAN_AGE_MS) continue;
    removeUploadIfUnused(url);
  }
}

setTimeout(() => void sweepOrphanUploads(), 30_000).unref();
setInterval(() => void sweepOrphanUploads(), 6 * 60 * 60 * 1000).unref();
