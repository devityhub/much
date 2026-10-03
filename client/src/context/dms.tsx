import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { notify } from '../lib/notify';
import { getSocket } from '../lib/socket';
import { sounds } from '../lib/sounds';
import type { DmConversation, DmMessage, DmMessageRequest } from '../lib/types';
import { displayName } from '../lib/users';
import { useFriends } from './friends';
import { useToast } from './toast';

export interface DmThread {
  messages: DmMessage[];
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

interface DmContextValue {
  conversations: Record<number, DmConversation>;
  messageRequests: DmMessageRequest[];
  totalUnread: number;
  requestUnread: number;
  threads: Record<number, DmThread>;
  /** Quem está digitando para você agora. */
  typing: Record<number, true>;
  /** A página da DM está aberta: carrega o histórico e marca como lido. */
  openThread: (userId: number) => () => void;
  loadOlder: (userId: number) => Promise<void>;
  send: (userId: number, content: string, kind?: 'text' | 'sticker') => Promise<boolean>;
  remove: (userId: number, messageId: number) => Promise<void>;
  pin: (userId: number, messageId: number, pinned: boolean) => Promise<void>;
  /** Carrega o histórico para trás até a mensagem aparecer na conversa (para pular até ela). */
  loadUntil: (userId: number, messageId: number) => Promise<void>;
  notifyTyping: (userId: number) => void;
  acceptRequest: (userId: number) => Promise<void>;
  ignoreRequest: (userId: number) => Promise<void>;
}

const DmContext = createContext<DmContextValue | null>(null);

const EMPTY_THREAD: DmThread = { messages: [], hasMore: false, loading: false, loaded: false };
const TYPING_SHOW_MS = 6000;
const TYPING_SEND_MS = 3000;

/** Pendentes (id negativo) ficam no fim até o servidor confirmar. */
function insertMessage(list: DmMessage[], message: DmMessage) {
  if (list.some((m) => m.id === message.id)) return list;
  const confirmed = list.filter((m) => m.id > 0);
  const pending = list.filter((m) => m.id < 0);
  const at = confirmed.findIndex((m) => m.id > message.id);
  if (at === -1) confirmed.push(message);
  else confirmed.splice(at, 0, message);
  return [...confirmed, ...pending];
}

export function DmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const toast = useToast();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Record<number, DmConversation>>({});
  const [messageRequests, setMessageRequests] = useState<DmMessageRequest[]>([]);
  const [threads, setThreads] = useState<Record<number, DmThread>>({});
  const [typing, setTyping] = useState<Record<number, true>>({});

  const meRef = useRef(user?.id);
  meRef.current = user?.id;
  const dndRef = useRef(false);
  dndRef.current = user?.presence === 'dnd';
  const friendsRef = useRef(friends);
  friendsRef.current = friends;
  const viewingRef = useRef<number | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const typingTimers = useRef(new Map<number, number>());
  const typingSent = useRef(new Map<number, number>());
  const tempId = useRef(0);

  const patchThread = useCallback((userId: number, patch: (thread: DmThread) => DmThread) => {
    setThreads((all) => ({ ...all, [userId]: patch(all[userId] ?? EMPTY_THREAD) }));
  }, []);

  const clearTyping = useCallback((userId: number) => {
    window.clearTimeout(typingTimers.current.get(userId));
    typingTimers.current.delete(userId);
    setTyping((all) => {
      if (!all[userId]) return all;
      const next = { ...all };
      delete next[userId];
      return next;
    });
  }, []);

  const markRead = useCallback((userId: number) => {
    const conversation = conversationsRef.current[userId];
    if (!conversation?.unread) return;
    const lastId = conversation.lastMessage.id;
    setConversations((all) => (all[userId] ? { ...all, [userId]: { ...all[userId], unread: 0 } } : all));
    void api(`/dms/${userId}/read`, { method: 'POST', body: { lastId } }).catch(() => undefined);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { conversations: list } = await api<{ conversations: DmConversation[] }>('/dms');
      setConversations(Object.fromEntries(list.map((c) => [c.userId, c])));
    } catch {
      // tenta de novo na próxima reconexão
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const { requests } = await api<{ requests: DmMessageRequest[] }>('/dms/requests');
      setMessageRequests(requests);
    } catch {
      // tenta de novo na próxima reconexão
    }
  }, []);

  const loadPage = useCallback(
    async (userId: number, before?: number) => {
      patchThread(userId, (t) => ({ ...t, loading: true }));
      try {
        const query = before ? `?before=${before}` : '';
        const { messages, hasMore } = await api<{ messages: DmMessage[]; hasMore: boolean }>(`/dms/${userId}/messages${query}`);
        patchThread(userId, (t) => ({
          messages: messages.reduce(insertMessage, before ? t.messages : t.messages.filter((m) => m.id < 0 || m.id > (messages.at(-1)?.id ?? 0))),
          hasMore,
          loading: false,
          loaded: true,
        }));
      } catch (err) {
        patchThread(userId, (t) => ({ ...t, loading: false }));
        toast((err as Error).message, 'error');
      }
    },
    [patchThread, toast],
  );

  useEffect(() => {
    const socket = getSocket();
    void loadConversations();
    void loadRequests();

    const onConnect = () => {
      void loadConversations();
      void loadRequests();
      setThreads({});
      const viewing = viewingRef.current;
      if (viewing) void loadPage(viewing);
    };

    const onMessage = (message: DmMessage) => {
      const me = meRef.current;
      const peer = message.senderId === me ? message.recipientId : message.senderId;
      const fromThem = message.senderId !== me;
      if (threadsRef.current[peer]?.loaded) patchThread(peer, (t) => ({ ...t, messages: insertMessage(t.messages, message) }));
      if (fromThem) clearTyping(peer);

      const watching = viewingRef.current === peer && !document.hidden;
      const isFriend = friendsRef.current.some((f) => f.user.id === peer);
      // Mensagem de desconhecido: atualiza a inbox de solicitações em vez das MDs.
      if (fromThem && !isFriend) {
        void loadRequests();
      } else {
        setConversations((all) => {
          const current = all[peer];
          if (current && current.lastMessage.id > message.id) return all;
          const unread = fromThem && !watching ? (current?.unread ?? 0) + 1 : (current?.unread ?? 0);
          return { ...all, [peer]: { userId: peer, lastMessage: message, unread } };
        });
      }
      if (!fromThem) return;
      if (watching) {
        void api(`/dms/${peer}/read`, { method: 'POST', body: { lastId: message.id } }).catch(() => undefined);
        return;
      }
      if (dndRef.current) return;
      sounds.message();
      const friend = friendsRef.current.find((f) => f.user.id === peer);
      const name = friend ? displayName(friend.user) : isFriend ? 'Nova mensagem' : 'Solicitação de mensagem';
      const body = message.kind === 'call' ? 'Você perdeu uma chamada' : message.kind === 'sticker' ? 'Mandou uma figurinha' : message.content;
      notify(name, body.length > 120 ? `${body.slice(0, 117)}...` : body, () =>
        navigate(isFriend ? `/app/dm/${peer}` : '/app/message-requests'),
      );
    };

    const onDeleted = ({ userId, id }: { userId: number; id: number }) => {
      patchThread(userId, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== id) }));
      if (conversationsRef.current[userId]?.lastMessage.id === id) void loadConversations();
    };

    const onPinned = ({ userId, id, pinnedAt }: { userId: number; id: number; pinnedAt: number | null }) => {
      patchThread(userId, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, pinnedAt } : m)) }));
    };

    const onRead = ({ userId }: { userId: number; lastId: number }) => {
      setConversations((all) => (all[userId] ? { ...all, [userId]: { ...all[userId], unread: 0 } } : all));
    };

    const onTyping = ({ from }: { from: number }) => {
      window.clearTimeout(typingTimers.current.get(from));
      typingTimers.current.set(
        from,
        window.setTimeout(() => clearTyping(from), TYPING_SHOW_MS),
      );
      setTyping((all) => (all[from] ? all : { ...all, [from]: true }));
    };

    const onVisible = () => {
      if (!document.hidden && viewingRef.current) markRead(viewingRef.current);
    };

    const onRequestsChanged = () => void loadRequests();
    const onConversationsChanged = () => void loadConversations();
    const onThreadCleared = ({ userId }: { userId: number }) => {
      setThreads((all) => {
        if (!all[userId]) return all;
        const next = { ...all };
        delete next[userId];
        return next;
      });
      setConversations((all) => {
        if (!all[userId]) return all;
        const next = { ...all };
        delete next[userId];
        return next;
      });
    };

    socket.on('connect', onConnect);
    socket.on('dm:message', onMessage);
    socket.on('dm:deleted', onDeleted);
    socket.on('dm:pinned', onPinned);
    socket.on('dm:read', onRead);
    socket.on('dm:typing', onTyping);
    socket.on('dm:requests-changed', onRequestsChanged);
    socket.on('dm:conversations-changed', onConversationsChanged);
    socket.on('dm:thread-cleared', onThreadCleared);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket.off('connect', onConnect);
      socket.off('dm:message', onMessage);
      socket.off('dm:deleted', onDeleted);
      socket.off('dm:pinned', onPinned);
      socket.off('dm:read', onRead);
      socket.off('dm:typing', onTyping);
      socket.off('dm:requests-changed', onRequestsChanged);
      socket.off('dm:conversations-changed', onConversationsChanged);
      socket.off('dm:thread-cleared', onThreadCleared);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadConversations, loadRequests, loadPage, patchThread, clearTyping, markRead, navigate]);

  useEffect(() => {
    for (const friend of friends) if (!friend.online) clearTyping(friend.user.id);
  }, [friends, clearTyping]);

  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  const openThread = useCallback(
    (userId: number) => {
      viewingRef.current = userId;
      if (!threadsRef.current[userId]?.loaded) void loadPage(userId);
      if (!document.hidden) markRead(userId);
      return () => {
        if (viewingRef.current === userId) viewingRef.current = null;
      };
    },
    [loadPage, markRead],
  );

  // Mensagem nova chegou na conversa aberta antes de a lista carregar.
  useEffect(() => {
    const viewing = viewingRef.current;
    if (viewing && conversations[viewing]?.unread && !document.hidden) markRead(viewing);
  }, [conversations, markRead]);

  const loadOlder = useCallback(
    async (userId: number) => {
      const thread = threadsRef.current[userId];
      if (!thread?.hasMore || thread.loading) return;
      const oldest = thread.messages.find((m) => m.id > 0);
      if (oldest) await loadPage(userId, oldest.id);
    },
    [loadPage],
  );

  const send = useCallback(
    async (userId: number, content: string, kind: 'text' | 'sticker' = 'text') => {
      const me = meRef.current;
      const text = content.trim();
      if (!me || !text) return false;
      const pending: DmMessage = {
        id: -++tempId.current,
        senderId: me,
        recipientId: userId,
        kind,
        content: text,
        callDuration: null,
        createdAt: Date.now(),
        pinnedAt: null,
      };
      patchThread(userId, (t) => ({ ...t, messages: [...t.messages, pending] }));
      typingSent.current.delete(userId);
      try {
        const message = await api<DmMessage>(`/dms/${userId}/messages`, { method: 'POST', body: { kind, content: text } });
        patchThread(userId, (t) => ({ ...t, messages: insertMessage(t.messages.filter((m) => m.id !== pending.id), message) }));
        setConversations((all) =>
          all[userId] && all[userId].lastMessage.id > message.id ? all : { ...all, [userId]: { userId, lastMessage: message, unread: 0 } },
        );
        return true;
      } catch (err) {
        patchThread(userId, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== pending.id) }));
        toast((err as Error).message, 'error');
        return false;
      }
    },
    [patchThread, toast],
  );

  const remove = useCallback(
    async (userId: number, messageId: number) => {
      try {
        await api(`/dms/${userId}/messages/${messageId}`, { method: 'DELETE' });
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    },
    [toast],
  );

  const pin = useCallback(
    async (userId: number, messageId: number, pinned: boolean) => {
      try {
        await api(`/dms/${userId}/messages/${messageId}/pin`, { method: pinned ? 'PUT' : 'DELETE' });
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    },
    [toast],
  );

  const loadUntil = useCallback(
    async (userId: number, messageId: number) => {
      const thread = threadsRef.current[userId];
      if (!thread?.loaded || thread.messages.some((m) => m.id === messageId)) return;
      let oldest = thread.messages.find((m) => m.id > 0)?.id ?? Number.MAX_SAFE_INTEGER;
      let hasMore = thread.hasMore;
      const collected: DmMessage[] = [];
      try {
        while (hasMore && oldest > messageId) {
          const page = await api<{ messages: DmMessage[]; hasMore: boolean }>(`/dms/${userId}/messages?before=${oldest}&limit=100`);
          if (!page.messages.length) break;
          collected.unshift(...page.messages);
          hasMore = page.hasMore;
          oldest = page.messages[0].id;
        }
      } catch (err) {
        toast((err as Error).message, 'error');
      }
      // Uma atualização só no fim: a conversa não fica pulando página por página.
      if (collected.length) patchThread(userId, (t) => ({ ...t, messages: collected.reduce(insertMessage, t.messages), hasMore }));
    },
    [patchThread, toast],
  );

  const notifyTyping = useCallback((userId: number) => {
    const now = Date.now();
    if (now - (typingSent.current.get(userId) ?? 0) < TYPING_SEND_MS) return;
    typingSent.current.set(userId, now);
    getSocket().emit('dm:typing', { to: userId });
  }, []);

  const acceptRequest = useCallback(
    async (userId: number) => {
      await api(`/dms/${userId}/accept-request`, { method: 'POST' });
      await Promise.all([loadRequests(), loadConversations()]);
    },
    [loadRequests, loadConversations],
  );

  const ignoreRequest = useCallback(
    async (userId: number) => {
      await api(`/dms/${userId}/ignore-request`, { method: 'POST' });
      setThreads((all) => {
        if (!all[userId]) return all;
        const next = { ...all };
        delete next[userId];
        return next;
      });
      await loadRequests();
    },
    [loadRequests],
  );

  const totalUnread = useMemo(() => Object.values(conversations).reduce((sum, c) => sum + c.unread, 0), [conversations]);
  const requestUnread = useMemo(() => messageRequests.reduce((sum, r) => sum + r.unread, 0), [messageRequests]);

  const value = useMemo(
    () => ({
      conversations,
      messageRequests,
      totalUnread,
      requestUnread,
      threads,
      typing,
      openThread,
      loadOlder,
      send,
      remove,
      pin,
      loadUntil,
      notifyTyping,
      acceptRequest,
      ignoreRequest,
    }),
    [
      conversations,
      messageRequests,
      totalUnread,
      requestUnread,
      threads,
      typing,
      openThread,
      loadOlder,
      send,
      remove,
      pin,
      loadUntil,
      notifyTyping,
      acceptRequest,
      ignoreRequest,
    ],
  );
  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}

export function useDms() {
  const ctx = useContext(DmContext);
  if (!ctx) throw new Error('useDms precisa estar dentro de DmProvider');
  return ctx;
}
