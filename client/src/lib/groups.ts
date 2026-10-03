import { displayName } from './users';
import type { Group, GroupMessage, GroupSystemEvent, PublicUser } from './types';

/** Igual ao servidor: até 10 pessoas por grupo, contando você. */
export const MAX_GROUP_MEMBERS = 10;

/** Sem nome dado, o grupo se chama pelos outros membros, como no Discord. */
export function groupName(group: Pick<Group, 'name' | 'members'>, meId: number | undefined) {
  if (group.name) return group.name;
  const others = group.members.filter((m) => m.id !== meId);
  return others.length ? others.map(displayName).join(', ') : 'Só você';
}

function list(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

export function parseSystemEvent(message: Pick<GroupMessage, 'content'>): GroupSystemEvent | null {
  try {
    return JSON.parse(message.content) as GroupSystemEvent;
  } catch {
    return null;
  }
}

/** Frase do aviso, sem o nome de quem fez (ele aparece em negrito antes). */
export function systemAction(event: GroupSystemEvent | null) {
  switch (event?.type) {
    case 'create':
      return `criou o grupo com ${list(event.names)}`;
    case 'add':
      return `adicionou ${list(event.names)} ao grupo`;
    case 'remove':
      return `removeu ${list(event.names)} do grupo`;
    case 'leave':
      return 'saiu do grupo';
    case 'rename':
      return event.name ? `mudou o nome do grupo para ${event.name}` : 'tirou o nome do grupo';
    case 'icon':
      return 'mudou o ícone do grupo';
    case 'owner':
      return 'agora é dono do grupo';
    default:
      return 'mexeu no grupo';
  }
}

export function lastGroupPreview(message: GroupMessage, authorOf: (id: number) => PublicUser | undefined, meId: number | undefined) {
  const author = message.senderId === meId ? 'Você' : (authorOf(message.senderId) ? displayName(authorOf(message.senderId)!) : 'Alguém');
  if (message.kind === 'system') return `${author} ${systemAction(parseSystemEvent(message))}`;
  if (message.kind === 'call') return message.callDuration !== null ? 'Chamada de voz' : 'Chamada perdida';
  if (message.kind === 'sticker') return `${author}: figurinha`;
  return `${author}: ${message.content.replace(/\s+/g, ' ')}`;
}
