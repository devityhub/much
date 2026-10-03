#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const id = process.argv[2];
const secret = process.argv[3];
if (!id || !secret) {
  console.error('Usage: node scripts/set-spotify-keys.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH || path.join(root, 'data', 'streamflix.db');
const db = new Database(dbPath);
const upsert = db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
upsert.run('spotify.client_id', id);
upsert.run('spotify.client_secret', secret);
console.log('Spotify keys saved to', dbPath);
