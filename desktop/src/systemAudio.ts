import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app, type WebContents } from 'electron';

export type StartResult = { ok: true } | { ok: false; error: string };

/** system: tudo do PC (menos Discord/PassTime). spotify: só o Spotify, para o modo DJ. */
export type CaptureKind = 'system' | 'spotify';

export const CAPTURE_KINDS: readonly CaptureKind[] = ['system', 'spotify'];

const BYTES_PER_FRAME = 4; // s16le estéreo
const READY_TIMEOUT_MS = 5000;
const SPOTIFY_EXE = 'spotify';

interface Capture {
  child: ChildProcessWithoutNullStreams;
  owner: WebContents;
}

const captures = new Map<CaptureKind, Capture>();

function executablePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'audio-capture.exe')
    : path.resolve(__dirname, '..', '..', 'native', 'audio-capture', 'build', 'Release', 'audio-capture.exe');
}

function send(owner: WebContents, channel: string, payload: unknown) {
  if (!owner.isDestroyed()) owner.send(channel, payload);
}

function argsFor(kind: CaptureKind) {
  const args = ['--watch-stdin', '--exclude-pid', String(process.pid)];
  if (kind === 'spotify') args.push('--include-name', SPOTIFY_EXE);
  // Com o DJ ativo, a música já vai na faixa própria; não manda de novo junto da tela.
  else if (captures.has('spotify')) args.push('--exclude-name', SPOTIFY_EXE);
  return args;
}

function endChild(child: ChildProcessWithoutNullStreams) {
  child.stdin.end();
  setTimeout(() => {
    if (child.exitCode === null) child.kill();
  }, 1000);
}

export function stopSystemAudio(owner?: WebContents, kind?: CaptureKind) {
  for (const k of kind ? [kind] : CAPTURE_KINDS) {
    const current = captures.get(k);
    if (!current || (owner && current.owner !== owner)) continue;
    captures.delete(k);
    endChild(current.child);
    if (k === 'spotify') restartSystemCapture();
  }
}

/** Reinicia a captura do sistema (sem avisar o site) para incluir ou tirar o Spotify. */
function restartSystemCapture() {
  const system = captures.get('system');
  if (!system || system.owner.isDestroyed()) return;
  void spawnCapture('system', system.owner);
}

function spawnCapture(kind: CaptureKind, owner: WebContents): Promise<StartResult> {
  const previous = captures.get(kind);
  const child = spawn(executablePath(), argsFor(kind), {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  captures.set(kind, { child, owner });
  if (previous) endChild(previous.child);
  const isCurrent = () => captures.get(kind)?.child === child;
  const dataChannel = `${kind}-audio:data`;
  const statusChannel = `${kind}-audio:status`;

  return new Promise<StartResult>((resolve) => {
    let settled = false;
    let lastError = '';
    const settle = (result: StartResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => settle({ ok: true }), READY_TIMEOUT_MS);

    let remainder = Buffer.alloc(0);
    child.stdout.on('data', (chunk: Buffer) => {
      if (!isCurrent()) return;
      if (owner.isDestroyed()) {
        stopSystemAudio(undefined, kind);
        return;
      }
      const data = remainder.length ? Buffer.concat([remainder, chunk]) : chunk;
      const usable = data.length - (data.length % BYTES_PER_FRAME);
      remainder = Buffer.from(data.subarray(usable));
      if (usable > 0) owner.send(dataChannel, data.subarray(0, usable));
    });

    let pending = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text: string) => {
      pending += text;
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        if (!line) continue;
        let status: { event?: string; message?: string };
        try {
          status = JSON.parse(line);
        } catch {
          console.log(`[audio-capture:${kind}]`, line);
          continue;
        }
        if (status.event === 'ready') settle({ ok: true });
        if (status.event === 'error') lastError = status.message ?? lastError;
        if (status.event === 'log') console.log(`[audio-capture:${kind}]`, status.message);
        if (isCurrent()) send(owner, statusChannel, status);
      }
    });

    child.on('error', (err) => {
      if (isCurrent()) captures.delete(kind);
      settle({ ok: false, error: `Falha ao iniciar audio-capture.exe: ${err.message}` });
    });

    child.on('exit', (code) => {
      const wasCurrent = isCurrent();
      if (wasCurrent) captures.delete(kind);
      if (!settled) {
        settle({ ok: false, error: lastError || `audio-capture.exe encerrou (código ${code})` });
      } else if (wasCurrent) {
        send(owner, statusChannel, { event: 'exit', code });
      }
    });
  });
}

/**
 * Inicia o audio-capture.exe. Sempre exclui a árvore de processos deste app
 * (a voz dos outros participantes toca aqui e não pode voltar na transmissão).
 */
export function startSystemAudio(owner: WebContents, kind: CaptureKind = 'system'): Promise<StartResult> {
  stopSystemAudio(undefined, kind);

  if (process.platform !== 'win32') {
    return Promise.resolve({ ok: false, error: 'A captura de áudio de programas só funciona no Windows.' });
  }
  const exe = executablePath();
  if (!fs.existsSync(exe)) {
    return Promise.resolve({
      ok: false,
      error: `audio-capture.exe não encontrado (${exe}). Compile native/audio-capture com build.bat.`,
    });
  }

  const started = spawnCapture(kind, owner);
  if (kind === 'spotify') restartSystemCapture();
  return started;
}
