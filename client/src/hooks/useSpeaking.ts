import { useEffect, useState } from 'react';

let sharedContext: AudioContext | null = null;

const THRESHOLD = 0.035;
const HOLD_TICKS = 4;

export function useSpeaking(stream: MediaStream | null | undefined): boolean {
  const [speaking, setSpeaking] = useState(false);
  const trackId = stream?.getAudioTracks()[0]?.id;

  useEffect(() => {
    if (!stream || !trackId) {
      setSpeaking(false);
      return;
    }
    sharedContext ??= new AudioContext();
    const ctx = sharedContext;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    let current = false;
    let hold = 0;
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
      }
      const loud = Math.sqrt(sum / data.length) > THRESHOLD;
      hold = loud ? HOLD_TICKS : Math.max(0, hold - 1);
      const next = loud || hold > 0;
      if (next !== current) {
        current = next;
        setSpeaking(next);
      }
    }, 100);

    return () => {
      window.clearInterval(timer);
      source.disconnect();
      analyser.disconnect();
      setSpeaking(false);
    };
  }, [stream, trackId]);

  return speaking;
}
