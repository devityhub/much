import { ApiError, tokenStore } from './api';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** GIFs vão sem recorte para continuarem animados, então têm limite próprio. */
export const MAX_GIF_BYTES = 2 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export async function uploadImage(blob: Blob): Promise<string> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: blob,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Não foi possível enviar a imagem', res.status);
  return data.url as string;
}

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use uma imagem PNG, JPG, WEBP ou GIF.';
  if (file.size > MAX_SOURCE_BYTES) return 'Imagem grande demais (máximo de 8 MB).';
  if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) return 'GIF grande demais (máximo de 2 MB).';
  return null;
}
