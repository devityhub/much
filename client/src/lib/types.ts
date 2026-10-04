export interface PublicUser {
  id: number;
  nick: string;
  avatar: string;
  avatarImage?: string | null;
  displayName?: string | null;
  bio?: string;
  pronouns?: string;
  banner?: string;
  bannerImage?: string | null;
  customStatus?: string;
  createdAt?: string | null;
}

export type Presence = 'online' | 'idle' | 'dnd' | 'invisible';
/** Como os outros te veem: invisível aparece como offline. */
export type VisiblePresence = 'online' | 'idle' | 'dnd' | 'offline';

export interface SelfUser extends PublicUser {
  presence: Presence;
}

export interface ProfilePatch {
  avatar?: string;
  displayName?: string;
  bio?: string;
  pronouns?: string;
  banner?: string;
  customStatus?: string;
  presence?: Presence;
  avatarImage?: string | null;
  bannerImage?: string | null;
}

export interface RoomPatch {
  name?: string;
  cover?: string;
  coverImage?: string | null;
  iconImage?: string | null;
  description?: string;
  promoted?: boolean;
}

export interface MediaState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
  screenAudio: boolean;
  music?: boolean;
  micStreamId?: string;
  camStreamId?: string;
  screenStreamId?: string;
  musicStreamId?: string;
}

export interface RoomMember {
  socketId: string;
  user: PublicUser;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  music?: boolean;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: string;
  album: string;
  image: string | null;
  durationMs: number;
  url: string | null;
}

/** Música tocando na sala/chamada (o DJ manda o áudio do Spotify dele). */
export interface RoomMusic {
  dj: PublicUser;
  djSocketId: string;
  track: SpotifyTrack | null;
  progressMs: number;
  isPlaying: boolean;
  error: string | null;
}

export interface SpotifyAccount {
  configured: boolean;
  linked: boolean;
  name: string | null;
  premium: boolean;
  /** Exibir o card do Spotify no perfil (estilo Discord). */
  showOnProfile: boolean;
  /** Exibir “ouvindo agora” como status para amigos. */
  showAsStatus: boolean;
  /** Só o dono do servidor cadastra as chaves do app do Spotify, e só quando não vêm do .env. */
  canConfigure: boolean;
  fromEnv: boolean;
  /** Redirect URI que precisa estar cadastrada no app do Spotify. */
  redirectUri: string;
}

export interface Room {
  id: string;
  name: string;
  cover: string;
  coverImage: string | null;
  iconImage: string | null;
  description: string;
  /** Sala que o dono escolheu divulgar no perfil dele. */
  promoted: boolean;
  createdAt: string;
  owner: PublicUser;
  maxParticipants: number;
  live: {
    participants: number;
    streaming: boolean;
    streamers: string[];
    members: RoomMember[];
  };
}

export interface Participant {
  socketId: string;
  user: PublicUser;
  media: MediaState;
  joinedAt: number;
}

export type Activity =
  | { type: 'room'; roomId: string; roomName: string }
  | { type: 'call' }
  | { type: 'spotify'; name: string; artists: string }
  | null;

export interface Friend {
  id: number;
  user: PublicUser;
  online: boolean;
  presence: VisiblePresence;
  activity: Activity;
  since: string;
}

export type Relationship = 'self' | 'friend' | 'incoming' | 'outgoing' | 'blocked' | 'none';

/** O que a pessoa está ouvindo no Spotify agora. Só leitura: o PassTime não controla a música dela. */
export interface ProfileListening {
  track: SpotifyTrack;
  progressMs: number;
  isPlaying: boolean;
  /** Só vem quando ela está tocando essa música para uma sala, como DJ. */
  roomId: string | null;
  roomName: string | null;
  listeners: number;
  /** Cliente: quando o snapshot chegou, para alinhar o relógio da faixa. */
  receivedAt?: number;
}

export interface UserProfile {
  user: PublicUser;
  relationship: Relationship;
  requestId: number | null;
  since: string | null;
  /** Só vem para amigos (e para você mesmo). */
  presence: VisiblePresence | null;
  activity: Activity;
  /** Amigos em comum: o total e os primeiros para mostrar. */
  mutualFriends: { total: number; users: PublicUser[] };
  stats: { friends: number; rooms: number; stickers: number };
  /** `current` só vem quando dá para ver o status da pessoa; `promoted` é a sala que ela divulga. */
  rooms: { current: Room | null; owned: Room[]; promoted: Room | null };
  /** Conta Spotify ligada e marcada para aparecer no perfil (mesmo sem música tocando). */
  spotify: { name: string; premium: boolean } | null;
  listening: ProfileListening | null;
}

export interface FriendRequest {
  id: number;
  user: PublicUser;
  createdAt: string;
}

export interface DmMessage {
  id: number;
  senderId: number;
  recipientId: number;
  kind: 'text' | 'call' | 'sticker';
  /** Texto da mensagem ou, em figurinhas, a URL da imagem. */
  content: string;
  /** Só em chamadas: segundos de conversa, ou null quando ninguém atendeu. */
  callDuration: number | null;
  createdAt: number;
  /** Quando foi fixada na conversa; null se não está fixada. */
  pinnedAt: number | null;
}

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: number;
  kind: 'text' | 'sticker' | 'system' | 'call';
  /** Texto, URL da figurinha ou, em avisos do sistema, um JSON com o que aconteceu. */
  content: string;
  callDuration: number | null;
  createdAt: number;
  pinnedAt: number | null;
}

/** Avisos do grupo. Os nomes vêm gravados para o aviso continuar certo se a pessoa sair. */
export type GroupSystemEvent =
  | { type: 'create'; names: string[] }
  | { type: 'add'; names: string[] }
  | { type: 'remove'; names: string[] }
  | { type: 'leave' }
  | { type: 'rename'; name: string }
  | { type: 'icon' }
  | { type: 'owner'; name: string };

export interface Group {
  id: number;
  /** Vazio quando ninguém deu nome: aí o app mostra os nomes dos membros. */
  name: string;
  iconImage: string | null;
  ownerId: number;
  createdAt: number;
  members: PublicUser[];
  lastMessage: GroupMessage | null;
  unread: number;
  /** Quem está na chamada do grupo agora. */
  callMembers: number[];
}

export interface DmConversation {
  userId: number;
  lastMessage: DmMessage;
  unread: number;
}

/** Mensagem de quem ainda não é amigo — aparece em Solicitações de mensagens. */
export interface DmMessageRequest {
  userId: number;
  user: PublicUser;
  lastMessage: DmMessage;
  unread: number;
}
