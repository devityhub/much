import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { notify } from '../lib/notify';
import { getSocket } from '../lib/socket';
import { sounds } from '../lib/sounds';
import type { Friend, FriendRequest, PublicUser, Relationship } from '../lib/types';
import { useToast } from './toast';

interface FriendsData {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: PublicUser[];
}

interface FriendsContextValue extends FriendsData {
  loading: boolean;
  sendRequest: (nick: string) => Promise<{ status: 'pending' | 'accepted'; user: PublicUser }>;
  accept: (requestId: number) => Promise<void>;
  decline: (requestId: number) => Promise<void>;
  removeFriend: (userId: number) => Promise<void>;
  block: (userId: number) => Promise<void>;
  unblock: (userId: number) => Promise<void>;
  isBlocked: (userId: number) => boolean;
  /** Relação com o usuário a partir das listas já carregadas (sem ir ao servidor). */
  relationshipOf: (userId: number) => { relationship: Relationship; requestId: number | null };
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { user } = useAuth();
  const dndRef = useRef(false);
  dndRef.current = user?.presence === 'dnd';
  const [data, setData] = useState<FriendsData>({ friends: [], incoming: [], outgoing: [], blocked: [] });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await api('/friends'));
    } catch {
      // tenta de novo no próximo evento
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    void reload();
    const onChange = () => void reload();
    const onRequest = ({ from }: { from: PublicUser }) => {
      if (!dndRef.current) {
        sounds.notify();
        notify('Novo pedido de amizade', `${from.nick} quer ser seu amigo`);
      }
      toast(`${from.nick} quer ser seu amigo`, 'info');
    };
    const onAccepted = ({ by }: { by: PublicUser }) => {
      if (!dndRef.current) {
        sounds.notify();
        notify('Pedido aceito', `${by.nick} aceitou seu pedido de amizade`);
      }
      toast(`${by.nick} aceitou seu pedido de amizade`, 'success');
    };
    socket.on('friends:changed', onChange);
    socket.on('connect', onChange);
    socket.on('friends:request', onRequest);
    socket.on('friends:accepted', onAccepted);
    return () => {
      socket.off('friends:changed', onChange);
      socket.off('connect', onChange);
      socket.off('friends:request', onRequest);
      socket.off('friends:accepted', onAccepted);
    };
  }, [reload, toast]);

  const sendRequest = useCallback(
    async (nick: string) => {
      const result = await api<{ status: 'pending' | 'accepted'; user: PublicUser }>('/friends/requests', { method: 'POST', body: { nick } });
      await reload();
      return result;
    },
    [reload],
  );

  const accept = useCallback(
    async (requestId: number) => {
      await api(`/friends/requests/${requestId}/accept`, { method: 'POST' });
      await reload();
    },
    [reload],
  );

  const decline = useCallback(
    async (requestId: number) => {
      await api(`/friends/requests/${requestId}`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  const removeFriend = useCallback(
    async (userId: number) => {
      await api(`/friends/${userId}`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  const block = useCallback(
    async (userId: number) => {
      await api(`/users/${userId}/block`, { method: 'POST' });
      await reload();
    },
    [reload],
  );

  const unblock = useCallback(
    async (userId: number) => {
      await api(`/users/${userId}/block`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  const blockedIds = useMemo(() => new Set(data.blocked.map((u) => u.id)), [data.blocked]);
  const isBlocked = useCallback((userId: number) => blockedIds.has(userId), [blockedIds]);

  const relationshipOf = useCallback(
    (userId: number): { relationship: Relationship; requestId: number | null } => {
      if (userId === user?.id) return { relationship: 'self', requestId: null };
      if (blockedIds.has(userId)) return { relationship: 'blocked', requestId: null };
      if (data.friends.some((f) => f.user.id === userId)) return { relationship: 'friend', requestId: null };
      const incoming = data.incoming.find((r) => r.user.id === userId);
      if (incoming) return { relationship: 'incoming', requestId: incoming.id };
      const outgoing = data.outgoing.find((r) => r.user.id === userId);
      if (outgoing) return { relationship: 'outgoing', requestId: outgoing.id };
      return { relationship: 'none', requestId: null };
    },
    [user?.id, blockedIds, data],
  );

  const value = useMemo(
    () => ({ ...data, loading, sendRequest, accept, decline, removeFriend, block, unblock, isBlocked, relationshipOf }),
    [data, loading, sendRequest, accept, decline, removeFriend, block, unblock, isBlocked, relationshipOf],
  );
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends precisa estar dentro de FriendsProvider');
  return ctx;
}
