import { useSyncExternalStore } from 'react';

export type ScreenAudioMode = 'system' | 'tab' | 'none';

export interface Settings {
  audioInputId: string;
  audioOutputId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  inputVolume: number;
  outputVolume: number;
  videoInputId: string;
  videoResolution: '480' | '720' | '1080';
  mirrorCamera: boolean;
  screenResolution: '720' | '1080' | '1440' | 'native';
  screenFps: 15 | 30 | 60;
  screenQuality: 'economy' | 'balanced' | 'high';
  screenContent: 'motion' | 'detail';
  screenAudio: ScreenAudioMode;
  sounds: boolean;
  /** Música do Spotify tocada pelo DJ da sala. */
  musicVolume: number;
  musicMuted: boolean;
}

const STORAGE_KEY = 'much.settings';

export const DEFAULT_SETTINGS: Settings = {
  audioInputId: '',
  audioOutputId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  inputVolume: 1,
  outputVolume: 1,
  videoInputId: '',
  videoResolution: '720',
  mirrorCamera: true,
  screenResolution: '1080',
  screenFps: 30,
  screenQuality: 'balanced',
  screenContent: 'motion',
  screenAudio: 'system',
  sounds: true,
  musicVolume: 0.7,
  musicMuted: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current = load();
const listeners = new Set<(next: Settings, prev: Settings) => void>();

export const settingsStore = {
  get: () => current,
  set(patch: Partial<Settings>) {
    const prev = current;
    current = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    for (const listener of listeners) listener(current, prev);
  },
  reset() {
    settingsStore.set(DEFAULT_SETTINGS);
  },
  subscribe(listener: (next: Settings, prev: Settings) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useSettings(): Settings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}

export const SCREEN_BITRATES: Record<Settings['screenQuality'], number> = {
  economy: 1_500_000,
  balanced: 4_000_000,
  high: 8_000_000,
};

export const SCREEN_HEIGHTS: Record<Exclude<Settings['screenResolution'], 'native'>, number> = {
  '720': 720,
  '1080': 1080,
  '1440': 1440,
};

export const CAMERA_SIZES: Record<Settings['videoResolution'], { width: number; height: number }> = {
  '480': { width: 640, height: 480 },
  '720': { width: 1280, height: 720 },
  '1080': { width: 1920, height: 1080 },
};

export function micConstraints(s: Settings): MediaTrackConstraints {
  return {
    deviceId: s.audioInputId ? { exact: s.audioInputId } : undefined,
    echoCancellation: s.echoCancellation,
    noiseSuppression: s.noiseSuppression,
    autoGainControl: s.autoGainControl,
  };
}

export function cameraConstraints(s: Settings): MediaTrackConstraints {
  const size = CAMERA_SIZES[s.videoResolution];
  return {
    deviceId: s.videoInputId ? { exact: s.videoInputId } : undefined,
    width: { ideal: size.width },
    height: { ideal: size.height },
    frameRate: { ideal: 30 },
  };
}
