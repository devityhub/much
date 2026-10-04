import { desktop, type CaptureKind, type SystemAudioStatus } from './desktop';

const SAMPLE_RATE = 48000;

// PCM s16le estéreo 48 kHz vindo do audio-capture.exe -> saída Float32 do AudioWorklet.
const WORKLET_SOURCE = `
class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = ${SAMPLE_RATE};
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.size = 0;
    this.primed = false;
    this.prebuffer = ${Math.round(SAMPLE_RATE * 0.04)};
    this.maxLatency = ${Math.round(SAMPLE_RATE * 0.2)};
    this.port.onmessage = (event) => this.push(new Int16Array(event.data));
  }

  push(samples) {
    const frames = samples.length >> 1;
    for (let i = 0; i < frames; i++) {
      if (this.size === this.capacity) {
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.size--;
      }
      this.left[this.writeIndex] = samples[2 * i] / 32768;
      this.right[this.writeIndex] = samples[2 * i + 1] / 32768;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.size++;
    }
    if (this.size > this.maxLatency) {
      const drop = this.size - this.prebuffer;
      this.readIndex = (this.readIndex + drop) % this.capacity;
      this.size -= drop;
    }
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    if (!this.primed) {
      if (this.size < this.prebuffer) return true;
      this.primed = true;
    }
    for (let i = 0; i < left.length; i++) {
      if (this.size > 0) {
        left[i] = this.left[this.readIndex];
        right[i] = this.right[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.capacity;
        this.size--;
      } else {
        left[i] = 0;
        right[i] = 0;
      }
    }
    if (this.size === 0) this.primed = false;
    return true;
  }
}
registerProcessor('pcm-player', PcmPlayer);
`;

export interface SystemAudioHandle {
  track: MediaStreamTrack;
  stop: () => void;
}

/**
 * Inicia o audio-capture.exe via app desktop e devolve uma faixa de áudio.
 * system: tudo que toca no PC, exceto Discord e o próprio PassTime. spotify: só o Spotify.
 */
export async function startSystemAudio(
  onStatus: (status: SystemAudioStatus) => void,
  kind: CaptureKind = 'system',
): Promise<SystemAudioHandle> {
  const api = desktop;
  if (!api) {
    throw new Error(
      kind === 'spotify'
        ? 'Tocar música do Spotify na sala só funciona no app desktop do PassTime'
        : 'O som do PC sem o Discord só está disponível no app desktop do PassTime',
    );
  }

  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
  const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
  try {
    await ctx.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const node = new AudioWorkletNode(ctx, 'pcm-player', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const destination = ctx.createMediaStreamDestination();
  destination.channelCount = 2;
  node.connect(destination);
  const track = destination.stream.getAudioTracks()[0];

  const offData = api.onSystemAudioData((chunk) => {
    const copy = new Uint8Array(chunk);
    node.port.postMessage(copy.buffer, [copy.buffer]);
  }, kind);
  const offStatus = api.onSystemAudioStatus(onStatus, kind);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    offData();
    offStatus();
    void api.stopSystemAudio(kind);
    node.disconnect();
    track.stop();
    void ctx.close();
  };

  const result = await api.startSystemAudio(kind);
  if (!result.ok) {
    stop();
    throw new Error(result.error);
  }
  await ctx.resume();
  return { track, stop };
}
