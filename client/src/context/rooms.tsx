import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { Room, RoomPatch } from '../lib/types';

interface RoomsContextValue {
  rooms: Room[];
  loading: boolean;
  reload: () => Promise<void>;
  createRoom: (data: RoomPatch & { name: string }) => Promise<Room>;
  updateRoom: (id: string, patch: RoomPatch) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;
}

const RoomsContext = createContext<RoomsContextValue | null>(null);

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const timer = useRef<number | null>(null);

  const reloadNow = useCallback(async () => {
    const gen = ++generation.current;
    try {
      const { rooms: next } = await api<{ rooms: Room[] }>('/rooms');
      // Resposta velha de um reload anterior não apaga a lista atual.
      if (gen !== generation.current) return;
      setRooms(next);
    } catch {
      // mantém a lista anterior; o socket avisa quando mudar de novo
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  /** Agrupa rajadas de rooms:changed (entrar/sair/mídia) num único GET. */
  const reload = useCallback(async () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    await new Promise<void>((resolve) => {
        timer.current = window.setTimeout(() => {
          timer.current = null;
          void reloadNow().finally(resolve);
        }, 220);
    });
  }, [reloadNow]);

  useEffect(() => {
    const socket = getSocket();
    void reloadNow();
    const onChange = () => void reload();
    socket.on('rooms:changed', onChange);
    socket.on('connect', onChange);
    return () => {
      socket.off('rooms:changed', onChange);
      socket.off('connect', onChange);
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [reload, reloadNow]);

  const createRoom = useCallback(
    async (data: RoomPatch & { name: string }) => {
      const { room } = await api<{ room: Room }>('/rooms', { method: 'POST', body: data });
      await reloadNow();
      return room;
    },
    [reloadNow],
  );

  const updateRoom = useCallback(
    async (id: string, patch: RoomPatch) => {
      const { room } = await api<{ room: Room }>(`/rooms/${id}`, { method: 'PATCH', body: patch });
      await reloadNow();
      return room;
    },
    [reloadNow],
  );

  const deleteRoom = useCallback(
    async (id: string) => {
      await api(`/rooms/${id}`, { method: 'DELETE' });
      setRooms((all) => all.filter((r) => r.id !== id));
      await reloadNow();
    },
    [reloadNow],
  );

  const value = useMemo(
    () => ({ rooms, loading, reload: reloadNow, createRoom, updateRoom, deleteRoom }),
    [rooms, loading, reloadNow, createRoom, updateRoom, deleteRoom],
  );
  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>;
}

export function useRooms() {
  const ctx = useContext(RoomsContext);
  if (!ctx) throw new Error('useRooms precisa estar dentro de RoomsProvider');
  return ctx;
}
