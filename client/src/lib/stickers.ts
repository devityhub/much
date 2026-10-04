import { api } from './api';

export interface Sticker {
  id: number;
  url: string;
  name: string;
}

/** Pacote que já vem com o PassTime (arquivos em public/stickers). */
export const BUILTIN_STICKERS = [
  { id: 'amor', name: 'Amor' },
  { id: 'risada', name: 'Risada' },
  { id: 'choro', name: 'Choro' },
  { id: 'uau', name: 'Uau' },
  { id: 'raiva', name: 'Raiva' },
  { id: 'sono', name: 'Sono' },
  { id: 'piscada', name: 'Piscada' },
  { id: 'legal', name: 'Legal' },
  { id: 'festa', name: 'Festa' },
  { id: 'pensando', name: 'Pensando' },
  { id: 'coracao', name: 'Coração' },
  { id: 'estrela', name: 'Estrela' },
] as const;

export const MAX_STICKERS = 60;

export const builtinStickerUrl = (id: string) => `/stickers/${id}.svg`;

export const listStickers = () => api<{ stickers: Sticker[] }>('/stickers').then((r) => r.stickers);

export const addSticker = (url: string, name = '') => api<Sticker>('/stickers', { method: 'POST', body: { url, name } });

export const deleteSticker = (id: number) => api<void>(`/stickers/${id}`, { method: 'DELETE' });
