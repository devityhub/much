import { useCallback, useEffect, useState } from 'react';

export interface DeviceLists {
  audioinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  /** Falso enquanto o navegador esconde os nomes (sem permissão ainda). */
  labeled: boolean;
  requestAccess: (kind: 'audio' | 'video') => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMediaDevices(): DeviceLists {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setDevices(await navigator.mediaDevices.enumerateDevices());
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh);
  }, [refresh]);

  const requestAccess = useCallback(
    async (kind: 'audio' | 'video') => {
      const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
      stream.getTracks().forEach((t) => t.stop());
      await refresh();
    },
    [refresh],
  );

  const real = devices.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
  return {
    audioinput: real.filter((d) => d.kind === 'audioinput'),
    audiooutput: real.filter((d) => d.kind === 'audiooutput'),
    videoinput: real.filter((d) => d.kind === 'videoinput'),
    labeled: devices.some((d) => d.label),
    requestAccess,
    refresh,
  };
}
