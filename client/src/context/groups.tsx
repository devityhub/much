import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { groupName } from '../lib/groups';
import { notify } from '../lib/notify';
import { getSocket } from '../lib/socket';
import { sounds } from '../lib/sounds';
import type { Group, GroupMessage, PublicUser } from '../lib/types';
import { displayName } from '../lib/users';
import { useToast } from './toast';

export interface GroupThread {
  messages: GroupMessage[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

interface GroupsContextValue {
  groups: Record<number, Group>;
  loaded: boolean;
  totalUnread: number;
  threads: Record<number, GroupThread>;
  /** Quem está digitando em cada grupo. */
  typing: Record<number, number[]>;
  /** Todo mundo que já apareceu num grupo, inclusive quem saiu: autores de mensagens antigas. */
  people: Record<number, PublicUser>;
  openThread: (groupId: number) => () => void;
  loadOlder: (groupId: number) => Promise<void>;
  loadUntil: (groupId: number, messageId: number) => Promise<void>;
  send: (groupId: number, content: string, kind?: 'text' | 'sticker') => Promise<boolean>;
  remove: (groupId: number, messageId: number) => Promise<void>;
  pin: (groupId: number, messageId: number, pinned: boolean) => Promise<void>;
  notifyTyping: (groupId: number) => void;
  createGroup: (userIds: number[]) => Promise<Group>;
  addMembers: (groupId: number, userIds: number[]) => Promise<void>;
  removeMember: (groupId: number, userId: number) => Promise<void>;
  updateGroup: (groupId: number, patch: { name?: string; iconImage?: string | null }) => Promise<void>;
}

const GroupsContext = createContext<GroupsContextValue | null>(null);

interface GroupPage {
  messages: GroupMessage[];
  hasMore: boolean;
  formerMembers: PublicUser[];
}

const EMPTY_THREAD: GroupThread = { messages: [], hasMore: false, loading: false, loaded: false };
const TYPING_SHOW_MS = 6000;
const TYPING_SEND_MS = 3000;

/** Pendentes (id negativo) ficam no fim até o servidor confirmar. */
function insertMessage(list: GroupMessage[], message: GroupMessage) {
  if (list.some((m) => m.id === message.id)) return list;
  const confirmed = list.filter((m) => m.id > 0);
  const pending = list.filter((m) => m.id < 0);
  const at = confirmed.findIndex((m) => m.id > message.id);
  if (at === -1) confirmed.push(message);
  else confirmed.splice(at, 0, message);
  return [...confirmed, ...pending];
}

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Record<number, Group>>({});
  const [loaded, setLoaded] = useState(false);
  const [threads, setThreads] = useState<Record<number, GroupThread>>({});
  const [typing, setTyping] = useState<Record<number, number[]>>({});
  const [people, setPeople] = useState<Record<number, PublicUser>>({});

  const remember = useCallback((users: PublicUser[] | undefined) => {
    if (users?.length) setPeople((all) => ({ ...all, ...Object.fromEntries(users.map((u) => [u.id, u])) }));
  }, []);

  const meRef = useRef(user?.id);
  meRef.current = user?.id;
  const dndRef = useRef(false);
  dndRef.current = user?.presence === 'dnd';
  const viewingRef = useRef<number | null>(null);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const typingTimers = useRef(new Map<string, number>());
  const typingSent = useRef(new Map<number, number>());
  const tempId = useRef(0);

  const patchThread = useCallback((groupId: number, patch: (thread: GroupThread) => GroupThread) => {
    setThreads((all) => ({ ...all, [groupId]: patch(all[groupId] ?? EMPTY_THREAD) }));
  }, []);

  const stopTyping = useCallback((groupId: number, userId: number) => {
    const key = `${groupId}:${userId}`;
    window.clearTimeout(typingTimers.current.get(key));
    typingTimers.current.delete(key);
    setTyping((all) => {
      if (!all[groupId]?.includes(userId)) return all;
      return { ...all, [groupId]: all[groupId].filter((id) => id !== userId) };
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const { groups: list } = await api<{ groups: Group[] }>('/groups');
      setGroups(Object.fromEntries(list.map((g) => [g.id, g])));
      remember(list.flatMap((g) => g.members));
    } catch {
      // tenta de novo no próximo aviso do servidor
    } finally {
      setLoaded(true);
    }
  }, [remember]);

  const markRead = useCallback((groupId: number) => {
    const group = groupsRef.current[groupId];
    if (!group?.unread || !group.lastMessage) return;
    const lastId = group.lastMessage.id;
    setGroups((all) => (all[groupId] ? { ...all, [groupId]: { ...all[groupId], unread: 0 } } : all));
    void api(`/groups/${groupId}/read`, { method: 'POST', body: { lastId } }).catch(() => undefined);
  }, []);

  const loadPage = useCallback(
    async (groupId: number, before?: number) => {
      patchThread(groupId, (t) => ({ ...t, loading: true }));
      try {
        const query = before ? `?before=${before}` : '';
        const { messages, hasMore, formerMembers } = await api<GroupPage>(`/groups/${groupId}/messages${query}`);
        remember(formerMembers);
        patchThread(groupId, (t) => ({
          messages: messages.reduce(insertMessage, before ? t.messages : t.messages.filter((m) => m.id < 0 || m.id > (messages.at(-1)?.id ?? 0))),
          hasMore,
          loading: false,
          loaded: true,
        }));
      } catch (err) {
        patchThread(groupId, (t) => ({ ...t, loading: false }));
        toast((err as Error).message, 'error');
      }
    },
    [patchThread, toast, remember],
  );

  useEffect(() => {
    const socket = getSocket();
    void reload();

    const onConnect = () => {
      void reload();
      setThreads({});
      const viewing = viewingRef.current;
      if (viewing) void loadPage(viewing);
    };

    const onMessage = (message: GroupMessage) => {
      const me = meRef.current;
      const { groupId } = message;
      const fromThem = message.senderId !== me;
      if (threadsRef.current[groupId]?.loaded) patchThread(groupId, (t) => ({ ...t, messages: insertMessage(t.messages, message) }));
      if (fromThem) stopTyping(groupId, message.senderId);

      const watching = viewingRef.current === groupId && !document.hidden;
      // Avisos (alguém entrou, mudou o nome...) não acendem a conversa como mensagem nova.
      const counts = fromThem && message.kind !== 'system';
      setGroups((all) => {
        const current = all[groupId];
        if (!current) return all;
        if (current.lastMessage && current.lastMessage.id > message.id) return all;
        const unread = counts && !watching ? current.unread + 1 : current.unread;
        return { ...all, [groupId]: { ...current, lastMessage: message, unread } };
      });
      if (!counts) return;
      if (watching) {
        void api(`/groups/${groupId}/read`, { method: 'POST', body: { lastId: message.id } }).catch(() => undefined);
        return;
      }
      if (dndRef.current) return;
      sounds.message();
      const group = groupsRef.current[groupId];
      const author = group?.members.find((m) => m.id === message.senderId);
      const title = group ? groupName(group, me) : 'Grupo';
      const who = author ? displayName(author) : 'Alguém';
      const body = message.kind === 'call' ? 'Chamada no grupo' : message.kind === 'sticker' ? `${who} mandou uma figurinha` : `${who}: ${message.content}`;
      notify(title, body.length > 120 ? `${body.slice(0, 117)}...` : body, () => navigate(`/app/group/${groupId}`));
    };

    const onDeleted = ({ groupId, id }: { groupId: number; id: number }) => {
      patchThread(groupId, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== id) }));
      if (groupsRef.current[groupId]?.lastMessage?.id === id) void reload();
    };

    const onPinned = ({ groupId, id, pinnedAt }: { groupId: number; id: number; pinnedAt: number | null }) => {
      patchThread(groupId, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, pinnedAt } : m)) }));
    };

    const onRead = ({ groupId }: { groupId: number }) => {
      setGroups((all) => (all[groupId] ? { ...all, [groupId]: { ...all[groupId], unread: 0 } } : all));
    };

    const onTyping = ({ groupId, from }: { groupId: number; from: number }) => {
      const key = `${groupId}:${from}`;
      window.clearTimeout(typingTimers.current.get(key));
      typingTimers.current.set(
        key,
        window.setTimeout(() => stopTyping(groupId, from), TYPING_SHOW_MS),
      );
      setTyping((all) => (all[groupId]?.includes(from) ? all : { ...all, [groupId]: [...(all[groupId] ?? []), from] }));
    };

    const onChanged = () => void reload();
    const onVisible = () => {
      if (!document.hidden && viewingRef.current) markRead(viewingRef.current);
    };

    socket.on('connect', onConnect);
    socket.on('groups:changed', onChanged);
    socket.on('group:message', onMessage);
    socket.on('group:deleted', onDeleted);
    socket.on('group:pinned', onPinned);
    socket.on('group:read', onRead);
    socket.on('group:typing', onTyping);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off('connect', onConnect);
      socket.off('groups:changed', onChanged);
      socket.off('group:message', onMessage);
      socket.off('group:deleted', onDeleted);
      socket.off('group:pinned', onPinned);
      socket.off('group:read', onRead);
      socket.off('group:typing', onTyping);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload, loadPage, patchThread, stopTyping, markRead, navigate]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  const openThread = useCallback(
    (groupId: number) => {
      viewingRef.current = groupId;
      if (!threadsRef.current[groupId]?.loaded) void loadPage(groupId);
      if (!document.hidden) markRead(groupId);
      return () => {
        if (viewingRef.current === groupId) viewingRef.current = null;
      };
    },
    [loadPage, markRead],
  );

  // Mensagem nova chegou no grupo aberto antes de a lista atualizar.
  useEffect(() => {
    const viewing = viewingRef.current;
    if (viewing && groups[viewing]?.unread && !document.hidden) markRead(viewing);
  }, [groups, markRead]);

  const loadOlder = useCallback(
    async (groupId: number) => {
      const thread = threadsRef.current[groupId];
      if (!thread?.hasMore || thread.loading) return;
      const oldest = thread.messages.find((m) => m.id > 0);
      if (oldest) await loadPage(groupId, oldest.id);
    },
    [loadPage],
  );

  const loadUntil = useCallback(
    async (groupId: number, messageId: number) => {
      const thread = threadsRef.current[groupId];
      if (!thread?.loaded || thread.messages.some((m) => m.id === messageId)) return;
      let oldest = thread.messages.find((m) => m.id > 0)?.id ?? Number.MAX_SAFE_INTEGER;
      let hasMore = thread.hasMore;
      const collected: GroupMessage[] = [];
      try {
        while (hasMore && oldest > messageId) {
          const page = await api<GroupPage>(`/groups/${groupId}/messages?before=${oldest}&limit=100`);
          remember(page.formerMembers);
          if (!page.messages.length) break;
          collected.unshift(...page.messages);
          hasMore = page.hasMore;
          oldest = page.messages[0].id;
        }
      } catch (err) {
        toast((err as Error).message, 'error');
      }
      if (collected.length) patchThread(groupId, (t) => ({ ...t, messages: collected.reduce(insertMessage, t.messages), hasMore }));
    },
    [patchThread, toast, remember],
  );

  const send = useCallback(
    async (groupId: number, content: string, kind: 'text' | 'sticker' = 'text') => {
      const me = meRef.current;
      const text = content.trim();
      if (!me || !text) return false;
      const pending: GroupMessage = { id: -++tempId.current, groupId, senderId: me, kind, content: text, callDuration: null, createdAt: Date.now(), pinnedAt: null };
      patchThread(groupId, (t) => ({ ...t, messages: [...t.messages, pending] }));
      typingSent.current.delete(groupId);
      try {
        const message = await api<GroupMessage>(`/groups/${groupId}/messages`, { method: 'POST', body: { kind, content: text } });
        patchThread(groupId, (t) => ({ ...t, messages: insertMessage(t.messages.filter((m) => m.id !== pending.id), message) }));
        setGroups((all) => {
          const current = all[groupId];
          if (!current || (current.lastMessage && current.lastMessage.id > message.id)) return all;
          return { ...all, [groupId]: { ...current, lastMessage: message, unread: 0 } };
        });
        return true;
      } catch (err) {
        patchThread(groupId, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== pending.id) }));
        toast((err as Error).message, 'error');
        return false;
      }
    },
    [patchThread, toast],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (err) {
        toast((err as Error).message, 'error');
        throw err;
      }
    },
    [toast],
  );

  const remove = useCallback(
    (groupId: number, messageId: number) => run(() => api(`/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' })).catch(() => undefined),
    [run],
  );

  const pin = useCallback(
    (groupId: number, messageId: number, pinned: boolean) =>
      run(() => api(`/groups/${groupId}/messages/${messageId}/pin`, { method: pinned ? 'PUT' : 'DELETE' })).catch(() => undefined),
    [run],
  );

  const notifyTyping = useCallback((groupId: number) => {
    const now = Date.now();
    if (now - (typingSent.current.get(groupId) ?? 0) < TYPING_SEND_MS) return;
    typingSent.current.set(groupId, now);
    getSocket().emit('group:typing', { groupId });
  }, []);

  const createGroup = useCallback(
    async (userIds: number[]) => {
      try {
        const { group } = await api<{ group: Group }>('/groups', { method: 'POST', body: { userIds } });
        setGroups((all) => ({ ...all, [group.id]: group }));
        return group;
      } catch (err) {
        toast((err as Error).message, 'error');
        throw err;
      }
    },
    [toast],
  );

  const addMembers = useCallback(
    (groupId: number, userIds: number[]) => run(() => api(`/groups/${groupId}/members`, { method: 'POST', body: { userIds } })),
    [run],
  );

  const removeMember = useCallback(
    async (groupId: number, userId: number) => {
      await run(() => api(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }));
      if (userId === meRef.current) {
        setGroups((all) => {
          const next = { ...all };
          delete next[groupId];
          return next;
        });
      }
    },
    [run],
  );

  const updateGroup = useCallback(
    (groupId: number, patch: { name?: string; iconImage?: string | null }) => run(() => api(`/groups/${groupId}`, { method: 'PATCH', body: patch })),
    [run],
  );

  const totalUnread = useMemo(() => Object.values(groups).reduce((sum, g) => sum + g.unread, 0), [groups]);

  const value = useMemo(
    () => ({
      groups,
      loaded,
      totalUnread,
      threads,
      typing,
      people,
      openThread,
      loadOlder,
      loadUntil,
      send,
      remove,
      pin,
      notifyTyping,
      createGroup,
      addMembers,
      removeMember,
      updateGroup,
    }),
    [groups, loaded, totalUnread, threads, typing, people, openThread, loadOlder, loadUntil, send, remove, pin, notifyTyping, createGroup, addMembers, removeMember, updateGroup],
  );
  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups precisa estar dentro de GroupsProvider');
  return ctx;
}
