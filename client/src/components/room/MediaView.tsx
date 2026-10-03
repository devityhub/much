import { useEffect, useMemo, useRef, type VideoHTMLAttributes } from 'react';

function trackKey(stream: MediaStream | null) {
  return stream ? stream.getTracks().map((t) => t.id).join(',') : '';
}

interface VideoViewProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, 'muted'> {
  stream: MediaStream | null;
  mirror?: boolean;
}

/** Sempre mudo: o áudio é tocado pelos AudioSink globais. */
export function VideoView({ stream, mirror = false, className = '', ...rest }: VideoViewProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const key = trackKey(stream);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream, key]);

  return <video ref={ref} autoPlay playsInline muted className={`${className} ${mirror ? '-scale-x-100' : ''}`} {...rest} />;
}

type SinkAudioElement = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

/** Toca só as trilhas de áudio do stream, na saída e volume escolhidos. */
export function AudioSink({ stream, volume = 1, sinkId = '', muted = false }: { stream: MediaStream | null; volume?: number; sinkId?: string; muted?: boolean }) {
  const ref = useRef<SinkAudioElement>(null);
  const key = trackKey(stream);
  const audioOnly = useMemo(() => {
    const tracks = stream?.getAudioTracks() ?? [];
    return tracks.length ? new MediaStream(tracks) : null;
  }, [stream, key]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = audioOnly;
    if (audioOnly) void el.play().catch(() => undefined);
  }, [audioOnly]);

  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = ref.current;
    if (el?.setSinkId) void el.setSinkId(sinkId).catch(() => undefined);
  }, [sinkId]);

  return <audio ref={ref} autoPlay className="hidden" />;
}
