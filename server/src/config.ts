import 'dotenv/config';
import path from 'node:path';

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const servers: Array<{ urls: string[]; username?: string; credential?: string }> = [];
  const stun = list(process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302');
  if (stun.length) servers.push({ urls: stun });
  const turn = list(process.env.TURN_URLS);
  if (turn.length) {
    servers.push({
      urls: turn,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET precisa estar definido em producao');
}

const corsOrigins = list(process.env.CORS_ORIGIN);
// Sempre relativo ao pacote server/ (não ao cwd). Assim restart/túnel não troca de banco e some com as contas.
const serverRoot = path.resolve(__dirname, '..');
const dbPath = path.resolve(process.env.DB_PATH ?? path.join(serverRoot, 'data', 'streamflix.db'));

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  dbPath,
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? path.join(path.dirname(dbPath), 'uploads')),
  clientDist: path.resolve(serverRoot, '..', 'client', 'dist'),
  corsOrigin: corsOrigins.length ? corsOrigins : true,
  maxPeersPerRoom: Number(process.env.MAX_PEERS_PER_ROOM ?? 6),
  iceServers: buildIceServers(),
  sslKeyPath: process.env.SSL_KEY_PATH,
  sslCertPath: process.env.SSL_CERT_PATH,
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI ?? '',
    accountsUrl: process.env.SPOTIFY_ACCOUNTS_URL ?? 'https://accounts.spotify.com',
    apiUrl: process.env.SPOTIFY_API_URL ?? 'https://api.spotify.com/v1',
  },
};

export const spotifyConfigured = Boolean(config.spotify.clientId && config.spotify.clientSecret && config.spotify.redirectUri);
