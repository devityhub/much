import fs from 'node:fs';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  session,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { CAPTURE_KINDS, startSystemAudio, stopSystemAudio, type CaptureKind } from './systemAudio';

const DEFAULT_SERVER_URL = 'http://localhost:5173';
const ALLOWED_PERMISSIONS = new Set(['media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen', 'notifications']);

function readConfigUrl(file: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { serverUrl?: unknown };
    return typeof data.serverUrl === 'string' && data.serverUrl ? data.serverUrl : null;
  } catch {
    return null;
  }
}

/** Ordem: PASSTIME_URL / MUCH_URL > config.json em userData > config.json empacotado > padrão. */
function resolveServerUrl(): string {
  const candidates = [
    process.env.PASSTIME_URL,
    process.env.MUCH_URL,
    readConfigUrl(path.join(app.getPath('userData'), 'config.json')),
    readConfigUrl(app.isPackaged ? path.join(process.resourcesPath, 'config.json') : path.join(__dirname, '..', 'config.json')),
  ];
  return candidates.find((url): url is string => Boolean(url)) ?? DEFAULT_SERVER_URL;
}

const serverUrl = new URL(resolveServerUrl());
const serverOrigin = serverUrl.origin;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (serverUrl.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(serverUrl.hostname)) {
  // Câmera, microfone e tela exigem contexto seguro; libera o servidor HTTP da rede local.
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', serverOrigin);
}

let mainWindow: BrowserWindow | null = null;
let selectedSourceId: string | null = null;

function isTrustedUrl(url: string | undefined) {
  if (!url) return false;
  try {
    return new URL(url).origin === serverOrigin;
  } catch {
    return false;
  }
}

function assertTrusted(event: IpcMainInvokeEvent) {
  if (!isTrustedUrl(event.senderFrame?.url)) throw new Error('Origem não autorizada');
}

function errorPage(message: string) {
  const html = `<!doctype html><html><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0c0d11;color:#fff;font-family:Segoe UI,Arial,sans-serif;text-align:center">
    <div style="font:800 44px Segoe UI,sans-serif;letter-spacing:-1px;background:linear-gradient(90deg,#c4b5fd,#7c3aed);-webkit-background-clip:text;color:transparent">PassTime</div>
    <div style="font-size:20px">Não foi possível conectar ao servidor</div>
    <div style="color:#9097a6">${message}</div>
    <div style="color:#9097a6">Servidor configurado: ${serverUrl.href}</div>
    <button onclick="location.href='${serverUrl.href}'" style="margin-top:8px;padding:12px 26px;border:0;border-radius:12px;background:linear-gradient(135deg,#a855f7,#5b21b6);color:#fff;font-size:16px;font-weight:600;cursor:pointer">Tentar novamente</button>
  </body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0c0d11',
    title: 'PassTime',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url) && !url.startsWith('data:')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame && isTrustedUrl(url) && code !== -3) void contents.loadURL(errorPage(`${description} (${code})`));
  });
  contents.on('render-process-gone', () => stopSystemAudio(contents));
  contents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) stopSystemAudio(contents);
  });

  mainWindow.on('closed', () => {
    stopSystemAudio();
    mainWindow = null;
  });

  void mainWindow.loadURL(serverUrl.href);
}

function setupSession() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(details.requestingUrl));
  });
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && requestingOrigin === serverOrigin;
  });

  // O vídeo vem da fonte escolhida no seletor do site. O áudio NÃO vem daqui:
  // o loopback do Chromium pegaria o Discord junto, por isso usamos o audio-capture.exe.
  ses.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const source =
        sources.find((s) => s.id === selectedSourceId) ?? sources.find((s) => s.id.startsWith('screen:')) ?? sources[0];
      selectedSourceId = null;
      if (source) callback({ video: source });
      else callback({});
    } catch (err) {
      console.error('[passtime] falha ao capturar tela', err);
      callback({});
    }
  });
}

function captureKind(value: unknown): CaptureKind {
  return CAPTURE_KINDS.includes(value as CaptureKind) ? (value as CaptureKind) : 'system';
}

function setupIpc() {
  ipcMain.handle('sources:list', async (event) => {
    assertTrusted(event);
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
    }));
  });

  ipcMain.handle('sources:select', (event, id: unknown) => {
    assertTrusted(event);
    selectedSourceId = typeof id === 'string' ? id : null;
  });

  ipcMain.handle('system-audio:start', (event, kind: unknown) => {
    assertTrusted(event);
    return startSystemAudio(event.sender, captureKind(kind));
  });

  ipcMain.handle('system-audio:stop', (event, kind: unknown) => {
    assertTrusted(event);
    stopSystemAudio(event.sender, captureKind(kind));
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    setupSession();
    setupIpc();
    createWindow();
  });

  app.on('window-all-closed', () => {
    stopSystemAudio();
    app.quit();
  });

  app.on('before-quit', () => stopSystemAudio());
}
