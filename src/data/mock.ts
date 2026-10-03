export type Presence = "online" | "idle" | "dnd" | "offline";

export type Friend = {
  id: string;
  name: string;
  username: string;
  status: Presence;
  activity?: string;
  avatarHue: number;
};

export type DirectMessage = {
  id: string;
  name: string;
  status: Presence;
  avatarHue: number;
  unread?: number;
  group?: boolean;
};

export type MessageRequest = {
  id: string;
  name: string;
  username: string;
  preview: string;
  receivedAt: string;
  avatarHue: number;
};

export type Server = {
  id: string;
  name: string;
  initials: string;
  hue: number;
  unread?: boolean;
};

export type ActivityCard = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  avatarHue: number;
  kind: "voice" | "game";
};

export const currentUser = {
  name: "ana luiza",
  status: "dnd" as Presence,
  statusLabel: "Não perturbar",
  avatarHue: 330,
};

export const servers: Server[] = [
  { id: "home", name: "Início", initials: "M", hue: 235 },
  { id: "mush", name: "Mush", initials: "MU", hue: 145, unread: true },
  { id: "kush", name: "Kush PVP", initials: "KP", hue: 20 },
  { id: "squad", name: "Squad", initials: "SQ", hue: 280 },
  { id: "clips", name: "Clips", initials: "CL", hue: 200 },
];

export const friends: Friend[] = [
  {
    id: "1",
    name: "Lipezin",
    username: "lipezin",
    status: "online",
    activity: "Lucas 18:13",
    avatarHue: 210,
  },
  {
    id: "2",
    name: "caio",
    username: "caio",
    status: "online",
    activity: "Jogando KUSH PVP",
    avatarHue: 30,
  },
  {
    id: "3",
    name: "Bia",
    username: "bia.mush",
    status: "online",
    activity: "Assistindo Spotify",
    avatarHue: 320,
  },
  {
    id: "4",
    name: "Rafa",
    username: "rafa",
    status: "idle",
    activity: "Ausente",
    avatarHue: 45,
  },
  {
    id: "5",
    name: "nath",
    username: "nath",
    status: "online",
    activity: "No celular",
    avatarHue: 170,
  },
  {
    id: "6",
    name: "Dudu",
    username: "dudu",
    status: "dnd",
    activity: "Não perturbar",
    avatarHue: 0,
  },
  {
    id: "7",
    name: "vivi",
    username: "vivi",
    status: "online",
    activity: "Em uma call",
    avatarHue: 260,
  },
  {
    id: "8",
    name: "Theo",
    username: "theo",
    status: "online",
    activity: "Jogando Mush",
    avatarHue: 120,
  },
  {
    id: "9",
    name: "Mel",
    username: "mel",
    status: "online",
    activity: "Online",
    avatarHue: 350,
  },
  {
    id: "10",
    name: "Gui",
    username: "gui",
    status: "online",
    activity: "Custom Status",
    avatarHue: 190,
  },
  {
    id: "11",
    name: "Kaue",
    username: "kaue",
    status: "offline",
    activity: "Offline",
    avatarHue: 80,
  },
  {
    id: "12",
    name: "Lara",
    username: "lara",
    status: "offline",
    activity: "Offline",
    avatarHue: 300,
  },
];

export const pendingIncoming: Friend[] = [
  {
    id: "p1",
    name: "pedro.sk",
    username: "pedro.sk",
    status: "offline",
    activity: "Pedido de amizade recebido",
    avatarHue: 55,
  },
  {
    id: "p2",
    name: "isa",
    username: "isa",
    status: "offline",
    activity: "Pedido de amizade recebido",
    avatarHue: 200,
  },
];

export const pendingOutgoing: Friend[] = [
  {
    id: "p3",
    name: "murilo",
    username: "murilo",
    status: "offline",
    activity: "Pedido de amizade enviado",
    avatarHue: 15,
  },
];

export const directMessages: DirectMessage[] = [
  { id: "d1", name: "Lipezin", status: "online", avatarHue: 210, unread: 2 },
  { id: "d2", name: "caio", status: "online", avatarHue: 30 },
  { id: "d3", name: "Bia", status: "online", avatarHue: 320 },
  { id: "d4", name: "Squad Mush", status: "online", avatarHue: 145, group: true },
  { id: "d5", name: "Rafa", status: "idle", avatarHue: 45 },
  { id: "d6", name: "nath", status: "online", avatarHue: 170 },
  { id: "d7", name: "Theo", status: "online", avatarHue: 120 },
  { id: "d8", name: "Mel", status: "online", avatarHue: 350 },
];

export const messageRequests: MessageRequest[] = [
  {
    id: "mr1",
    name: "xXShadowXx",
    username: "shadow",
    preview: "oi, vi que você joga mush também",
    receivedAt: "há 2 h",
    avatarHue: 10,
  },
  {
    id: "mr2",
    name: "luna",
    username: "luna.gg",
    preview: "pode me add no servidor?",
    receivedAt: "ontem",
    avatarHue: 275,
  },
  {
    id: "mr3",
    name: "breno",
    username: "breno",
    preview: "manda o link da call",
    receivedAt: "há 3 d",
    avatarHue: 95,
  },
];

export const activeNow: ActivityCard[] = [
  {
    id: "a1",
    title: "Squad Mush",
    subtitle: "Em um canal de voz",
    detail: "Geral · 4 ouvindo",
    avatarHue: 145,
    kind: "voice",
  },
  {
    id: "a2",
    title: "caio",
    subtitle: "Jogando KUSH PVP",
    detail: "Solo · há 36 min",
    avatarHue: 30,
    kind: "game",
  },
  {
    id: "a3",
    title: "Theo",
    subtitle: "Jogando Mush",
    detail: "Sky Wars · há 12 min",
    avatarHue: 120,
    kind: "game",
  },
];
