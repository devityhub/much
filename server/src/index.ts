import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { config } from './config';
import { authRouter, requireAuth } from './auth';
import { dmsRouter } from './dms';
import { friendsRouter } from './friends';
import { createGroupsRouter } from './groups';
import { errorHandler } from './http';
import { createRoomsRouter } from './rooms';
import { setupSignaling } from './signaling';
import { spotifyRouter } from './spotify';
import { stickersRouter } from './stickers';
import { serveUploads, uploadsRouter } from './uploads';
import { usersRouter } from './users';

const app = express();
app.disable('x-powered-by');
// Túnel/proxy (Cloudflare etc.): req.protocol e host precisam refletir o HTTPS público.
app.set('trust proxy', true);
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

const server =
  config.sslKeyPath && config.sslCertPath
    ? https.createServer({ key: fs.readFileSync(config.sslKeyPath), cert: fs.readFileSync(config.sslCertPath) }, app)
    : http.createServer(app);

const io = new Server(server, { cors: { origin: config.corsOrigin } });
const signaling = setupSignaling(io);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.get('/api/ice', requireAuth, (_req, res) => {
  res.json({ iceServers: config.iceServers });
});
app.use('/api/auth', authRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/dms', dmsRouter);
app.use('/api/groups', createGroupsRouter(signaling.removeFromCall));
app.use('/api/rooms', createRoomsRouter(signaling.notifyRoomsChanged, signaling.kickRoom));
app.use('/api/uploads', uploadsRouter);
app.use('/api/users', usersRouter);
app.use('/api/spotify', spotifyRouter);
app.use('/api/stickers', stickersRouter);
app.use('/uploads', serveUploads, (_req, res) => {
  res.status(404).end();
});
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
} else {
  console.warn(`[much] client/dist não encontrado; rode "npm run build -w client" para servir o site por aqui.`);
}

app.use(errorHandler);

server.listen(config.port, '0.0.0.0', () => {
  const protocol = server instanceof https.Server ? 'https' : 'http';
  console.log(`[much] servidor em ${protocol}://0.0.0.0:${config.port}`);
  console.log(`[much] database ${config.dbPath}`);
});
