import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT 'red',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover TEXT NOT NULL DEFAULT 'cover-1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (requester_id, addressee_id)
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (blocker_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS spotify_accounts (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    product TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'call')),
    content TEXT NOT NULL DEFAULT '',
    call_duration INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS dm_messages_pair ON dm_messages (user_a, user_b, id);

  CREATE TABLE IF NOT EXISTS dm_reads (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    other_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, other_id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS stickers_user ON stickers (user_id, id);

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    icon_image TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS group_members_user ON group_members (user_id);

  CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'sticker', 'system', 'call')),
    content TEXT NOT NULL DEFAULT '',
    call_duration INTEGER,
    created_at INTEGER NOT NULL,
    pinned_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS group_messages_group ON group_messages (group_id, id);
`);

// O CHECK de dm_messages nasceu sem 'sticker'; o SQLite só aceita a mudança refazendo a tabela.
const dmTableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'dm_messages'").get() as
  | { sql: string }
  | undefined)?.sql;
if (dmTableSql && !dmTableSql.includes("'sticker'")) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    BEGIN;
    CREATE TABLE dm_messages_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'call', 'sticker')),
      content TEXT NOT NULL DEFAULT '',
      call_duration INTEGER,
      created_at INTEGER NOT NULL
    );
    INSERT INTO dm_messages_new (id, user_a, user_b, sender_id, kind, content, call_duration, created_at)
      SELECT id, user_a, user_b, sender_id, kind, content, call_duration, created_at FROM dm_messages;
    DROP TABLE dm_messages;
    ALTER TABLE dm_messages_new RENAME TO dm_messages;
    CREATE INDEX IF NOT EXISTS dm_messages_pair ON dm_messages (user_a, user_b, id);
    COMMIT;
  `);
  db.pragma('foreign_keys = ON');
}

const PROFILE_COLUMNS: Record<string, string> = {
  display_name: 'TEXT',
  bio: "TEXT NOT NULL DEFAULT ''",
  pronouns: "TEXT NOT NULL DEFAULT ''",
  banner: "TEXT NOT NULL DEFAULT 'cover-1'",
  custom_status: "TEXT NOT NULL DEFAULT ''",
  presence: "TEXT NOT NULL DEFAULT 'online'",
  avatar_image: 'TEXT',
  banner_image: 'TEXT',
};
const ROOM_COLUMNS: Record<string, string> = {
  cover_image: 'TEXT',
  icon_image: 'TEXT',
  description: "TEXT NOT NULL DEFAULT ''",
  /** Sala que o dono escolheu divulgar no perfil dele. */
  promoted: 'INTEGER NOT NULL DEFAULT 0',
};

function addMissingColumns(table: string, columns: Record<string, string>) {
  const existing = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name));
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}
addMissingColumns('users', PROFILE_COLUMNS);
addMissingColumns('rooms', ROOM_COLUMNS);
addMissingColumns('dm_messages', { pinned_at: 'INTEGER' });

/** Pedidos de mensagem de quem ainda não é amigo (estilo Discord). */
db.exec(`
  CREATE TABLE IF NOT EXISTS dm_request_states (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    other_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'ignored')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, other_id)
  );
  CREATE INDEX IF NOT EXISTS dm_request_states_user_status ON dm_request_states (user_id, status);
`);

export const AVATARS = ['red', 'blue', 'yellow', 'green', 'purple', 'pink', 'orange', 'teal'] as const;
export const COVERS = ['cover-1', 'cover-2', 'cover-3', 'cover-4', 'cover-5', 'cover-6', 'cover-7', 'cover-8'] as const;
export const PRESENCES = ['online', 'idle', 'dnd', 'invisible'] as const;
export type Presence = (typeof PRESENCES)[number];

export interface UserRow {
  id: number;
  nick: string;
  email: string;
  password_hash: string;
  avatar: string;
  created_at: string;
  display_name: string | null;
  bio: string;
  pronouns: string;
  banner: string;
  custom_status: string;
  presence: Presence;
  avatar_image: string | null;
  banner_image: string | null;
}

export interface RoomRow {
  id: string;
  name: string;
  owner_id: number;
  cover: string;
  cover_image: string | null;
  icon_image: string | null;
  description: string;
  promoted: number;
  created_at: string;
  owner_nick: string;
  owner_avatar: string;
  owner_avatar_image: string | null;
  owner_display_name: string | null;
}

export interface PublicUser {
  id: number;
  nick: string;
  avatar: string;
  avatarImage: string | null;
  displayName: string | null;
  bio: string;
  pronouns: string;
  banner: string;
  bannerImage: string | null;
  customStatus: string;
  createdAt: string | null;
}

type ProfileSource = Pick<UserRow, 'id' | 'nick' | 'avatar'> &
  Partial<Pick<UserRow, 'display_name' | 'bio' | 'pronouns' | 'banner' | 'custom_status' | 'created_at' | 'avatar_image' | 'banner_image'>>;

export function toPublicUser(row: ProfileSource): PublicUser {
  return {
    id: row.id,
    nick: row.nick,
    avatar: row.avatar,
    avatarImage: row.avatar_image ?? null,
    bannerImage: row.banner_image ?? null,
    displayName: row.display_name || null,
    bio: row.bio ?? '',
    pronouns: row.pronouns ?? '',
    banner: row.banner ?? 'cover-1',
    customStatus: row.custom_status ?? '',
    createdAt: row.created_at ?? null,
  };
}

/** O próprio usuário também vê o status escolhido (inclusive invisível). */
export function toSelfUser(row: UserRow) {
  return { ...toPublicUser(row), presence: row.presence };
}

export const queries = {
  userById: db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?'),
  userByLogin: db.prepare<[string, string], UserRow>('SELECT * FROM users WHERE nick = ? OR email = ?'),
  userByNickOrEmail: db.prepare<[string, string], Pick<UserRow, 'nick' | 'email'>>(
    'SELECT nick, email FROM users WHERE nick = ? OR email = ?',
  ),
  insertUser: db.prepare<[string, string, string, string]>(
    'INSERT INTO users (nick, email, password_hash, avatar) VALUES (?, ?, ?, ?)',
  ),
  updateProfile: db.prepare<
    [string, string | null, string, string, string, string, Presence, string | null, string | null, number]
  >(`
    UPDATE users
    SET avatar = ?, display_name = ?, bio = ?, pronouns = ?, banner = ?, custom_status = ?, presence = ?,
      avatar_image = ?, banner_image = ?
    WHERE id = ?
  `),

  allRooms: db.prepare<[], RoomRow>(`
    SELECT r.*, u.nick AS owner_nick, u.avatar AS owner_avatar, u.avatar_image AS owner_avatar_image,
      u.display_name AS owner_display_name
    FROM rooms r JOIN users u ON u.id = r.owner_id
    ORDER BY r.created_at DESC
  `),
  roomById: db.prepare<[string], RoomRow>(`
    SELECT r.*, u.nick AS owner_nick, u.avatar AS owner_avatar, u.avatar_image AS owner_avatar_image,
      u.display_name AS owner_display_name
    FROM rooms r JOIN users u ON u.id = r.owner_id
    WHERE r.id = ?
  `),
  roomsOwnedBy: db.prepare<[number], RoomRow>(`
    SELECT r.*, u.nick AS owner_nick, u.avatar AS owner_avatar, u.avatar_image AS owner_avatar_image,
      u.display_name AS owner_display_name
    FROM rooms r JOIN users u ON u.id = r.owner_id
    WHERE r.owner_id = ?
    ORDER BY r.created_at DESC
  `),
  /** A sala divulgada no perfil do dono: só uma por pessoa, a mais recente que ele marcou. */
  promotedRoomOf: db.prepare<[number], RoomRow>(`
    SELECT r.*, u.nick AS owner_nick, u.avatar AS owner_avatar, u.avatar_image AS owner_avatar_image,
      u.display_name AS owner_display_name
    FROM rooms r JOIN users u ON u.id = r.owner_id
    WHERE r.owner_id = ? AND r.promoted = 1
    ORDER BY r.created_at DESC
    LIMIT 1
  `),
  clearPromotedRooms: db.prepare<[number]>('UPDATE rooms SET promoted = 0 WHERE owner_id = ?'),
  insertRoom: db.prepare<[string, string, number, string, string | null, string | null, string, number]>(
    'INSERT INTO rooms (id, name, owner_id, cover, cover_image, icon_image, description, promoted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ),
  updateRoom: db.prepare<[string, string, string | null, string | null, string, number, string]>(
    'UPDATE rooms SET name = ?, cover = ?, cover_image = ?, icon_image = ?, description = ?, promoted = ? WHERE id = ?',
  ),
  uploadReferences: db.prepare<{ url: string }, { count: number }>(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE avatar_image = @url OR banner_image = @url) +
      (SELECT COUNT(*) FROM rooms WHERE cover_image = @url OR icon_image = @url) +
      (SELECT COUNT(*) FROM stickers WHERE url = @url) +
      (SELECT COUNT(*) FROM dm_messages WHERE kind = 'sticker' AND content = @url) +
      (SELECT COUNT(*) FROM groups WHERE icon_image = @url) +
      (SELECT COUNT(*) FROM group_messages WHERE kind = 'sticker' AND content = @url) AS count
  `),
  deleteRoom: db.prepare<[string]>('DELETE FROM rooms WHERE id = ?'),

  userByNick: db.prepare<[string], UserRow>('SELECT * FROM users WHERE nick = ?'),
  friendshipById: db.prepare<[number], FriendshipRow>('SELECT * FROM friendships WHERE id = ?'),
  friendshipBetween: db.prepare<[number, number, number, number], FriendshipRow>(`
    SELECT * FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
  `),
  friendshipsOf: db.prepare<[number, number, number], FriendshipWithUserRow>(`
    SELECT f.*, u.id AS other_id, u.nick AS other_nick, u.avatar AS other_avatar,
      u.display_name AS other_display_name, u.bio AS other_bio, u.pronouns AS other_pronouns,
      u.banner AS other_banner, u.custom_status AS other_custom_status, u.presence AS other_presence,
      u.created_at AS other_created_at, u.avatar_image AS other_avatar_image, u.banner_image AS other_banner_image
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE f.requester_id = ? OR f.addressee_id = ?
    ORDER BY u.nick COLLATE NOCASE
  `),
  acceptedFriendIds: db.prepare<[number, number, number], { id: number }>(`
    SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS id
    FROM friendships
    WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)
  `),
  countFriends: db.prepare<[number, number], { count: number }>(`
    SELECT COUNT(*) AS count FROM friendships
    WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)
  `),
  /** Amigos que os dois têm em comum. */
  mutualFriends: db.prepare<{ me: number; other: number }, UserRow>(`
    SELECT u.* FROM users u
    WHERE u.id IN (
      SELECT CASE WHEN f.requester_id = @me THEN f.addressee_id ELSE f.requester_id END
      FROM friendships f WHERE f.status = 'accepted' AND (f.requester_id = @me OR f.addressee_id = @me)
      INTERSECT
      SELECT CASE WHEN f.requester_id = @other THEN f.addressee_id ELSE f.requester_id END
      FROM friendships f WHERE f.status = 'accepted' AND (f.requester_id = @other OR f.addressee_id = @other)
    )
    ORDER BY u.nick COLLATE NOCASE
  `),
  insertFriendship: db.prepare<[number, number]>(
    "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')",
  ),
  acceptFriendship: db.prepare<[number]>("UPDATE friendships SET status = 'accepted' WHERE id = ?"),
  deleteFriendship: db.prepare<[number]>('DELETE FROM friendships WHERE id = ?'),

  blockExists: db.prepare<[number, number], { blocker_id: number }>(
    'SELECT blocker_id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
  ),
  insertBlock: db.prepare<[number, number]>('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)'),
  deleteBlock: db.prepare<[number, number]>('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?'),
  blockedUsers: db.prepare<[number], UserRow>(`
    SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ?
    ORDER BY u.nick COLLATE NOCASE
  `),

  spotifyAccount: db.prepare<[number], SpotifyAccountRow>('SELECT * FROM spotify_accounts WHERE user_id = ?'),
  upsertSpotifyAccount: db.prepare<[number, string, string, number, string, string]>(`
    INSERT INTO spotify_accounts (user_id, access_token, refresh_token, expires_at, display_name, product)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at,
      display_name = excluded.display_name, product = excluded.product
  `),
  updateSpotifyTokens: db.prepare<[string, string, number, number]>(
    'UPDATE spotify_accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?',
  ),
  deleteSpotifyAccount: db.prepare<[number]>('DELETE FROM spotify_accounts WHERE user_id = ?'),
  /** As chaves do app do Spotify valem para o servidor todo, então ninguém fica ligado quando elas mudam. */
  clearSpotifyAccounts: db.prepare('DELETE FROM spotify_accounts'),

  setting: db.prepare<[string], { value: string }>('SELECT value FROM app_settings WHERE key = ?'),
  setSetting: db.prepare<[string, string]>(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `),
  deleteSetting: db.prepare<[string]>('DELETE FROM app_settings WHERE key = ?'),
  /** A primeira conta criada é a dona do servidor: é quem pode mexer nas chaves do Spotify. */
  firstUserId: db.prepare<[], { id: number }>('SELECT id FROM users ORDER BY id LIMIT 1'),

  stickersOf: db.prepare<[number], StickerRow>('SELECT * FROM stickers WHERE user_id = ? ORDER BY id DESC'),
  countStickers: db.prepare<[number], { count: number }>('SELECT COUNT(*) AS count FROM stickers WHERE user_id = ?'),
  stickerById: db.prepare<[number], StickerRow>('SELECT * FROM stickers WHERE id = ?'),
  insertSticker: db.prepare<[number, string, string, number]>(
    'INSERT INTO stickers (user_id, url, name, created_at) VALUES (?, ?, ?, ?)',
  ),
  deleteSticker: db.prepare<[number]>('DELETE FROM stickers WHERE id = ?'),

  insertDm: db.prepare<[number, number, number, DmKind, string, number | null, number]>(
    'INSERT INTO dm_messages (user_a, user_b, sender_id, kind, content, call_duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ),
  dmById: db.prepare<[number], DmRow>('SELECT * FROM dm_messages WHERE id = ?'),
  dmPage: db.prepare<[number, number, number, number], DmRow>(
    'SELECT * FROM dm_messages WHERE user_a = ? AND user_b = ? AND id < ? ORDER BY id DESC LIMIT ?',
  ),
  deleteDm: db.prepare<[number]>('DELETE FROM dm_messages WHERE id = ?'),
  setDmPinned: db.prepare<[number | null, number]>('UPDATE dm_messages SET pinned_at = ? WHERE id = ?'),
  dmPins: db.prepare<[number, number], DmRow>(
    'SELECT * FROM dm_messages WHERE user_a = ? AND user_b = ? AND pinned_at IS NOT NULL ORDER BY pinned_at DESC',
  ),
  countDmPins: db.prepare<[number, number], { count: number }>(
    'SELECT COUNT(*) AS count FROM dm_messages WHERE user_a = ? AND user_b = ? AND pinned_at IS NOT NULL',
  ),
  /** Busca só no texto: figurinhas e chamadas não têm o que procurar. */
  searchDms: db.prepare<[number, number, string, number], DmRow>(`
    SELECT * FROM dm_messages
    WHERE user_a = ? AND user_b = ? AND kind = 'text' AND content LIKE ? ESCAPE '\\'
    ORDER BY id DESC LIMIT ?
  `),
  /** Última mensagem de cada conversa do usuário, com quantas ele ainda não leu. */
  dmConversations: db.prepare<{ me: number }, DmRow & { unread: number }>(`
    SELECT m.*, (
      SELECT COUNT(*) FROM dm_messages u
      WHERE u.user_a = m.user_a AND u.user_b = m.user_b AND u.sender_id != @me
        AND u.id > COALESCE((
          SELECT last_read_id FROM dm_reads r
          WHERE r.user_id = @me AND r.other_id = CASE WHEN m.user_a = @me THEN m.user_b ELSE m.user_a END
        ), 0)
    ) AS unread
    FROM dm_messages m
    WHERE m.id IN (SELECT MAX(id) FROM dm_messages WHERE user_a = @me OR user_b = @me GROUP BY user_a, user_b)
    ORDER BY m.id DESC
  `),
  markDmRead: db.prepare<[number, number, number]>(`
    INSERT INTO dm_reads (user_id, other_id, last_read_id) VALUES (?, ?, ?)
    ON CONFLICT (user_id, other_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)
  `),

  dmRequestState: db.prepare<[number, number], { status: 'pending' | 'accepted' | 'ignored' }>(
    'SELECT status FROM dm_request_states WHERE user_id = ? AND other_id = ?',
  ),
  upsertDmRequest: db.prepare<[number, number, 'pending' | 'accepted' | 'ignored', number]>(`
    INSERT INTO dm_request_states (user_id, other_id, status, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, other_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
  `),
  deleteDmRequest: db.prepare<[number, number]>('DELETE FROM dm_request_states WHERE user_id = ? AND other_id = ?'),
  deleteDmPair: db.prepare<[number, number]>('DELETE FROM dm_messages WHERE user_a = ? AND user_b = ?'),
  deleteDmReadsPair: db.prepare<[number, number, number, number]>(`
    DELETE FROM dm_reads
    WHERE (user_id = ? AND other_id = ?) OR (user_id = ? AND other_id = ?)
  `),
  /** Solicitações pendentes: última mensagem de quem te escreveu sem ser amigo. */
  dmMessageRequests: db.prepare<{ me: number }, DmRow & { unread: number }>(`
    SELECT m.*, (
      SELECT COUNT(*) FROM dm_messages u
      WHERE u.user_a = m.user_a AND u.user_b = m.user_b AND u.sender_id != @me
        AND u.id > COALESCE((
          SELECT last_read_id FROM dm_reads r
          WHERE r.user_id = @me AND r.other_id = CASE WHEN m.user_a = @me THEN m.user_b ELSE m.user_a END
        ), 0)
    ) AS unread
    FROM dm_messages m
    JOIN dm_request_states s
      ON s.user_id = @me
      AND s.other_id = CASE WHEN m.user_a = @me THEN m.user_b ELSE m.user_a END
      AND s.status = 'pending'
    WHERE m.id IN (
      SELECT MAX(id) FROM dm_messages WHERE user_a = @me OR user_b = @me GROUP BY user_a, user_b
    )
    ORDER BY m.id DESC
  `),

  insertGroup: db.prepare<[string, number, number]>('INSERT INTO groups (name, owner_id, created_at) VALUES (?, ?, ?)'),
  groupById: db.prepare<[number], GroupRow>('SELECT * FROM groups WHERE id = ?'),
  updateGroup: db.prepare<[string, string | null, number]>('UPDATE groups SET name = ?, icon_image = ? WHERE id = ?'),
  setGroupOwner: db.prepare<[number, number]>('UPDATE groups SET owner_id = ? WHERE id = ?'),
  deleteGroup: db.prepare<[number]>('DELETE FROM groups WHERE id = ?'),
  groupMembers: db.prepare<[number], UserRow & { joined_at: number }>(`
    SELECT u.*, m.joined_at FROM group_members m JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ?
    ORDER BY m.joined_at, u.id
  `),
  groupMemberIds: db.prepare<[number], { user_id: number }>('SELECT user_id FROM group_members WHERE group_id = ? ORDER BY joined_at, user_id'),
  groupMembership: db.prepare<[number, number], { last_read_id: number }>(
    'SELECT last_read_id FROM group_members WHERE group_id = ? AND user_id = ?',
  ),
  addGroupMember: db.prepare<[number, number, number]>('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)'),
  removeGroupMember: db.prepare<[number, number]>('DELETE FROM group_members WHERE group_id = ? AND user_id = ?'),
  /** Grupos do usuário com a última mensagem e quantas ele ainda não leu (as dele não contam). */
  groupsOf: db.prepare<{ me: number }, GroupRow & { last_read_id: number; last_id: number | null; unread: number }>(`
    SELECT g.*, m.last_read_id,
      (SELECT MAX(id) FROM group_messages WHERE group_id = g.id) AS last_id,
      (SELECT COUNT(*) FROM group_messages x WHERE x.group_id = g.id AND x.id > m.last_read_id AND x.sender_id != @me) AS unread
    FROM groups g JOIN group_members m ON m.group_id = g.id AND m.user_id = @me
  `),
  markGroupRead: db.prepare<[number, number, number]>(
    'UPDATE group_members SET last_read_id = MAX(last_read_id, ?) WHERE group_id = ? AND user_id = ?',
  ),
  insertGroupMessage: db.prepare<[number, number, GroupMessageKind, string, number | null, number]>(
    'INSERT INTO group_messages (group_id, sender_id, kind, content, call_duration, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ),
  groupMessageById: db.prepare<[number], GroupMessageRow>('SELECT * FROM group_messages WHERE id = ?'),
  groupPage: db.prepare<[number, number, number], GroupMessageRow>(
    'SELECT * FROM group_messages WHERE group_id = ? AND id < ? ORDER BY id DESC LIMIT ?',
  ),
  deleteGroupMessage: db.prepare<[number]>('DELETE FROM group_messages WHERE id = ?'),
  setGroupPinned: db.prepare<[number | null, number]>('UPDATE group_messages SET pinned_at = ? WHERE id = ?'),
  groupPins: db.prepare<[number], GroupMessageRow>(
    'SELECT * FROM group_messages WHERE group_id = ? AND pinned_at IS NOT NULL ORDER BY pinned_at DESC',
  ),
  countGroupPins: db.prepare<[number], { count: number }>(
    'SELECT COUNT(*) AS count FROM group_messages WHERE group_id = ? AND pinned_at IS NOT NULL',
  ),
  searchGroup: db.prepare<[number, string, number], GroupMessageRow>(`
    SELECT * FROM group_messages
    WHERE group_id = ? AND kind = 'text' AND content LIKE ? ESCAPE '\\'
    ORDER BY id DESC LIMIT ?
  `),
};

export interface GroupRow {
  id: number;
  name: string;
  icon_image: string | null;
  owner_id: number;
  created_at: number;
}

export type GroupMessageKind = 'text' | 'sticker' | 'system' | 'call';

export interface GroupMessageRow {
  id: number;
  group_id: number;
  sender_id: number;
  kind: GroupMessageKind;
  content: string;
  call_duration: number | null;
  created_at: number;
  pinned_at: number | null;
}

export type DmKind = 'text' | 'call' | 'sticker';

export interface DmRow {
  id: number;
  user_a: number;
  user_b: number;
  sender_id: number;
  kind: DmKind;
  content: string;
  call_duration: number | null;
  created_at: number;
  pinned_at: number | null;
}

export interface StickerRow {
  id: number;
  user_id: number;
  url: string;
  name: string;
  created_at: number;
}

export interface SpotifyAccountRow {
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  display_name: string;
  product: string;
}

export function hasBlocked(blocker: number, blocked: number) {
  return Boolean(queries.blockExists.get(blocker, blocked));
}

export interface FriendshipRow {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface FriendshipWithUserRow extends FriendshipRow {
  other_id: number;
  other_nick: string;
  other_avatar: string;
  other_display_name: string | null;
  other_bio: string;
  other_pronouns: string;
  other_banner: string;
  other_custom_status: string;
  other_presence: Presence;
  other_created_at: string;
  other_avatar_image: string | null;
  other_banner_image: string | null;
}
