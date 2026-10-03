import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';
import { attachListening, listeningStore } from './listening';

let socket: Socket | null = null;

/** Conexão única com o servidor, compartilhada por amigos, salas e chamadas. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      auth: (cb) => cb({ token: tokenStore.get() }),
      transports: ['websocket', 'polling'],
    });
    attachListening(socket);
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  listeningStore.clear();
}
