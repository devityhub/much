import type { Presence, PublicUser, VisiblePresence } from './types';

export function displayName(user: Pick<PublicUser, 'nick' | 'displayName'>) {
  return user.displayName || user.nick;
}

export const PRESENCE_INFO: Record<Presence, { label: string; hint?: string }> = {
  online: { label: 'Disponível' },
  idle: { label: 'Ausente', hint: 'Seus amigos veem que você saiu por um momento.' },
  dnd: { label: 'Não perturbe', hint: 'Você não vai receber toques de chamada nem avisos.' },
  invisible: { label: 'Invisível', hint: 'Você aparece offline, mas continua usando o Much normalmente.' },
};

export function visiblePresence(presence: Presence): VisiblePresence {
  return presence === 'invisible' ? 'offline' : presence;
}

export function presenceLabel(presence: VisiblePresence) {
  return presence === 'offline' ? 'Offline' : PRESENCE_INFO[presence].label;
}
