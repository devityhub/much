import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type CaptureKind = 'system' | 'spotify';

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const kindOf = (kind?: CaptureKind): CaptureKind => (kind === 'spotify' ? 'spotify' : 'system');

// Contrato espelhado em client/src/lib/desktop.ts (PassTimeDesktopApi).
const desktopApi = {
  isDesktop: true,
  platform: process.platform,
  captureKinds: ['system', 'spotify'],
  listSources: () => ipcRenderer.invoke('sources:list'),
  selectSource: (id: string) => ipcRenderer.invoke('sources:select', id),
  startSystemAudio: (kind?: CaptureKind) => ipcRenderer.invoke('system-audio:start', kindOf(kind)),
  stopSystemAudio: (kind?: CaptureKind) => ipcRenderer.invoke('system-audio:stop', kindOf(kind)),
  onSystemAudioData: (callback: (chunk: Uint8Array) => void, kind?: CaptureKind) => subscribe(`${kindOf(kind)}-audio:data`, callback),
  onSystemAudioStatus: (callback: (status: unknown) => void, kind?: CaptureKind) => subscribe(`${kindOf(kind)}-audio:status`, callback),
};
contextBridge.exposeInMainWorld('passtime', desktopApi);
contextBridge.exposeInMainWorld('much', desktopApi);
