import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

  const reload = useCallback(async () => {
    try {
      const { rooms } = await api<{ rooms: Room[] }>('/rooms');
      setRooms(rooms);
    } catch {
      // mantém a lista anterior; o socket avisa quando mudar de novo
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    void reload();
    const onChange = () => void reload();
    socket.on('rooms:changed', onChange);
    socket.on('connect', onChange);
    return () => {
      socket.off('rooms:changed', onChange);
      socket.off('connect', onChange);
    };
  }, [reload]);

  const createRoom = useCallback(
    async (data: RoomPatch & { name: string }) => {
      const { room } = await api<{ room: Room }>('/rooms', { method: 'POST', body: data });
      await reload();
      return room;
    },
    [reload],
  );

  const updateRoom = useCallback(
    async (id: string, patch: RoomPatch) => {
      const { room } = await api<{ room: Room }>(`/rooms/${id}`, { method: 'PATCH', body: patch });
      await reload();
      return room;
    },
    [reload],
  );

  const deleteRoom = useCallback(
    async (id: string) => {
      await api(`/rooms/${id}`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  const value = useMemo(
    () => ({ rooms, loading, reload, createRoom, updateRoom, deleteRoom }),
    [rooms, loading, reload, createRoom, updateRoom, deleteRoom],
  );
  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>;
}

export function useRooms() {
  const ctx = useContext(RoomsContext);
  if (!ctx) throw new Error('useRooms precisa estar dentro de RoomsProvider');
  return ctx;
}
