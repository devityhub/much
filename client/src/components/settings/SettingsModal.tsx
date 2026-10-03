import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Check, Download, Gauge, KeyRound, Link2, LogOut, Mic, MonitorUp, Palette, Pencil, Play, ShieldCheck, Square, User, Volume2, X } from 'lucide-react';
import Avatar from '../Avatar';
import ProfileSection from './ProfileSection';
import DevicesSection from './DevicesSection';
import ConnectionsSection from './ConnectionsSection';
import { Button, Segmented, Slider, Toggle } from '../ui';
import { VideoView } from '../room/MediaView';
import { DiscordAudioGuide } from '../room/ScreenShareDialog';
import { useUi, type SettingsSection } from '../../context/ui';
import { useCall } from '../../context/call';
import { useToast } from '../../context/toast';
import { useMediaDevices } from '../../hooks/useMediaDevices';
import { useAuth } from '../../lib/auth';
import { desktop } from '../../lib/desktop';
import { liteReason, setMotionMode, useMotionMode, type MotionMode } from '../../lib/performance';
import { mediaErrorMessage } from '../../lib/mediaErrors';
import { cameraConstraints, DEFAULT_SETTINGS, micConstraints, settingsStore, useSettings, type Settings } from '../../lib/settings';
import { coverBackground } from '../../lib/theme';
import { displayName, PRESENCE_INFO, visiblePresence } from '../../lib/users';
import type { Presence } from '../../lib/types';

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: ReactNode; group: string }> = [
  { id: 'account', label: 'Minha conta', icon: <User size={17} />, group: 'Usuário' },
  { id: 'profile', label: 'Perfil', icon: <Palette size={17} />, group: 'Usuário' },
  { id: 'connections', label: 'Conexões', icon: <Link2 size={17} />, group: 'Usuário' },
  { id: 'devices', label: 'Permissões e dispositivos', icon: <KeyRound size={17} />, group: 'App' },
  { id: 'voice', label: 'Voz e áudio', icon: <Mic size={17} />, group: 'App' },
  { id: 'video', label: 'Vídeo', icon: <Camera size={17} />, group: 'App' },
  { id: 'screen', label: 'Transmissão de tela', icon: <MonitorUp size={17} />, group: 'App' },
  { id: 'appearance', label: 'Aparência e desempenho', icon: <Gauge size={17} />, group: 'App' },
  { id: 'desktop', label: 'App desktop', icon: <Download size={17} />, group: 'App' },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface-2 p-5">{children}</div>;
}

function DeviceSelect({
  value,
  devices,
  onChange,
  labeled,
  onRequest,
  fallback,
}: {
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (id: string) => void;
  labeled: boolean;
  onRequest: () => void;
  fallback: string;
}) {
  return (
    <div className="space-y-2">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Padrão do sistema</option>
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${fallback} ${i + 1}`}
          </option>
        ))}
      </select>
      {!labeled && (
        <button onClick={onRequest} className="text-xs font-semibold text-accent hover:underline">
          Permitir acesso para ver os nomes dos dispositivos
        </button>
      )}
    </div>
  );
}

type SinkAudio = HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

/** Medidor do microfone com opção de se ouvir, como o “Vamos checar” do Discord. */
function MicTest({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const gainRef = useRef<GainNode | null>(null);
  const audioRef = useRef<SinkAudio | null>(null);

  useEffect(() => {
    if (!testing) return;
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    const ctx = new AudioContext();
    const audio: SinkAudio = new Audio();
    audioRef.current = audio;

    navigator.mediaDevices
      .getUserMedia({ audio: micConstraints(settingsStore.get()) })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const source = ctx.createMediaStreamSource(s);
        const gain = ctx.createGain();
        gain.gain.value = settingsStore.get().inputVolume;
        gainRef.current = gain;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        const dest = ctx.createMediaStreamDestination();
        source.connect(gain);
        gain.connect(analyser);
        gain.connect(dest);
        audio.srcObject = dest.stream;
        void audio.setSinkId?.(settingsStore.get().audioOutputId).catch(() => undefined);
        void audio.play().catch(() => undefined);

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((err) => {
        toast(mediaErrorMessage(err, 'microfone') ?? 'Não foi possível usar o microfone', 'error');
        setTesting(false);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      audio.pause();
      audio.srcObject = null;
      void ctx.close();
      gainRef.current = null;
      setLevel(0);
    };
    // Reinicia o teste quando mudam as opções que exigem abrir o microfone de novo.
  }, [testing, settings.audioInputId, settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl, toast]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = settings.inputVolume;
  }, [settings.inputVolume]);

  useEffect(() => {
    void audioRef.current?.setSinkId?.(settings.audioOutputId).catch(() => undefined);
  }, [settings.audioOutputId]);

  const bars = 32;
  return (
    <div className="flex items-center gap-4">
      <Button variant={testing ? 'danger' : 'secondary'} onClick={() => setTesting((t) => !t)} className="w-40 shrink-0">
        {testing ? <Square size={16} /> : <Mic size={16} />}
        {testing ? 'Parar teste' : 'Vamos checar'}
      </Button>
      <div className="flex h-8 flex-1 items-center gap-[3px]">
        {Array.from({ length: bars }, (_, i) => {
          const lit = level * bars > i;
          return (
            <motion.span
              key={i}
              animate={{ opacity: lit ? 1 : 0.25, scaleY: lit ? 1 : 0.6 }}
              transition={{ duration: 0.08 }}
              className={`h-full flex-1 rounded-sm ${i > bars * 0.8 ? 'bg-warn' : 'bg-ok'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function playTestSound(sinkId: string, volume: number) {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const gain = ctx.createGain();
  gain.gain.value = 0.25 * volume;
  gain.connect(dest);
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.3);
  });
  const audio: SinkAudio = new Audio();
  audio.srcObject = dest.stream;
  void audio.setSinkId?.(sinkId).catch(() => undefined);
  void audio.play();
  window.setTimeout(() => {
    audio.pause();
    void ctx.close();
  }, 1100);
}

function VoiceSection() {
  const s = useSettings();
  const devices = useMediaDevices();
  const set = settingsStore.set;
  const canPickOutput = 'setSinkId' in HTMLMediaElement.prototype;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Dispositivo de entrada">
          <DeviceSelect
            value={s.audioInputId}
            devices={devices.audioinput}
            onChange={(id) => set({ audioInputId: id })}
            labeled={devices.labeled}
            onRequest={() => void devices.requestAccess('audio')}
            fallback="Microfone"
          />
        </Field>
        <Field label="Dispositivo de saída" hint={canPickOutput ? undefined : 'Seu navegador não permite escolher a saída.'}>
          <DeviceSelect
            value={s.audioOutputId}
            devices={devices.audiooutput}
            onChange={(id) => set({ audioOutputId: id })}
            labeled={devices.labeled}
            onRequest={() => void devices.requestAccess('audio')}
            fallback="Saída"
          />
        </Field>
        <Field label={`Volume de entrada · ${Math.round(s.inputVolume * 100)}%`}>
          <Slider value={s.inputVolume} max={2} onChange={(v) => set({ inputVolume: v })} />
        </Field>
        <Field label={`Volume de saída · ${Math.round(s.outputVolume * 100)}%`}>
          <div className="flex items-center gap-3">
            <Slider value={s.outputVolume} onChange={(v) => set({ outputVolume: v })} />
            <button
              onClick={() => playTestSound(s.audioOutputId, s.outputVolume)}
              className="rounded-lg bg-surface-4 p-2 text-muted hover:text-white"
              title="Testar saída"
              aria-label="Testar saída"
            >
              <Play size={15} />
            </button>
          </div>
        </Field>
      </div>

      <Card>
        <p className="mb-1 font-semibold">Teste de microfone</p>
        <p className="mb-4 text-sm text-muted">Fale algo e você vai se ouvir de volta. Use fone para não dar eco.</p>
        <MicTest settings={s} />
      </Card>

      <div>
        <p className="mb-1 text-xs font-bold tracking-wider text-muted uppercase">Processamento de voz</p>
        <div className="divide-y divide-line">
          <Toggle label="Cancelamento de eco" hint="Evita que o som das caixas volte pelo microfone." checked={s.echoCancellation} onChange={(v) => set({ echoCancellation: v })} />
          <Toggle label="Supressão de ruído" hint="Reduz ventilador, teclado e barulhos de fundo." checked={s.noiseSuppression} onChange={(v) => set({ noiseSuppression: v })} />
          <Toggle label="Controle automático de ganho" hint="Ajusta o volume da sua voz sozinho." checked={s.autoGainControl} onChange={(v) => set({ autoGainControl: v })} />
          <Toggle label="Sons do app" hint="Entrada e saída de pessoas, mutar, chamadas." checked={s.sounds} onChange={(v) => set({ sounds: v })} />
        </div>
      </div>
    </div>
  );
}

function VideoSection() {
  const s = useSettings();
  const devices = useMediaDevices();
  const toast = useToast();
  const set = settingsStore.set;
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: cameraConstraints(settingsStore.get()) })
      .then((st) => {
        if (stopped) return st.getTracks().forEach((t) => t.stop());
        stream = st;
        setPreview(st);
      })
      .catch((err) => {
        toast(mediaErrorMessage(err, 'câmera') ?? 'Não foi possível abrir a câmera', 'error');
        setOn(false);
      });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      setPreview(null);
    };
  }, [on, s.videoInputId, s.videoResolution, toast]);

  return (
    <div className="space-y-6">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface-2">
        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full">
              <VideoView stream={preview} mirror={s.mirrorCamera} className="h-full w-full object-cover" />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 text-muted">
              <Camera size={40} />
              <Button variant="secondary" onClick={() => setOn(true)}>
                Testar vídeo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {preview && (
          <button onClick={() => setOn(false)} className="absolute top-3 right-3 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-black/80">
            Parar teste
          </button>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Câmera">
          <DeviceSelect
            value={s.videoInputId}
            devices={devices.videoinput}
            onChange={(id) => set({ videoInputId: id })}
            labeled={devices.labeled}
            onRequest={() => void devices.requestAccess('video')}
            fallback="Câmera"
          />
        </Field>
        <Field label="Resolução">
          <Segmented
            value={s.videoResolution}
            onChange={(v) => set({ videoResolution: v })}
            options={[
              { value: '480', label: '480p' },
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
            ]}
          />
        </Field>
      </div>
      <Toggle label="Espelhar minha câmera" hint="Só muda como você se vê. Os outros veem normal." checked={s.mirrorCamera} onChange={(v) => set({ mirrorCamera: v })} />
    </div>
  );
}

function ScreenSection() {
  const s = useSettings();
  const set = settingsStore.set;
  const audioOptions: Array<{ value: Settings['screenAudio']; label: string }> = desktop
    ? [
        { value: 'system', label: 'PC sem Discord' },
        { value: 'none', label: 'Sem áudio' },
      ]
    : [
        { value: 'system', label: 'PC inteiro' },
        { value: 'tab', label: 'Uma aba' },
        { value: 'none', label: 'Sem áudio' },
      ];
  const audioValue = desktop && s.screenAudio === 'tab' ? 'system' : s.screenAudio;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Resolução">
          <Segmented
            value={s.screenResolution}
            onChange={(v) => set({ screenResolution: v })}
            options={[
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
              { value: '1440', label: '1440p' },
              { value: 'native', label: 'Nativa' },
            ]}
          />
        </Field>
        <Field label="Taxa de quadros">
          <Segmented
            value={s.screenFps}
            onChange={(v) => set({ screenFps: v })}
            options={[
              { value: 15, label: '15 fps' },
              { value: 30, label: '30 fps' },
              { value: 60, label: '60 fps' },
            ]}
          />
        </Field>
        <Field label="Qualidade" hint="Mais qualidade usa mais internet de upload.">
          <Segmented
            value={s.screenQuality}
            onChange={(v) => set({ screenQuality: v })}
            options={[
              { value: 'economy', label: 'Econômica' },
              { value: 'balanced', label: 'Equilibrada' },
              { value: 'high', label: 'Alta' },
            ]}
          />
        </Field>
        <Field label="Priorizar" hint="Movimento para jogos e filmes; nitidez para texto e código.">
          <Segmented
            value={s.screenContent}
            onChange={(v) => set({ screenContent: v })}
            options={[
              { value: 'motion', label: 'Movimento' },
              { value: 'detail', label: 'Nitidez' },
            ]}
          />
        </Field>
      </div>

      <Field label="Áudio da transmissão">
        <Segmented value={audioValue} onChange={(v) => set({ screenAudio: v })} options={audioOptions} />
      </Field>

      {desktop ? (
        <div className="flex items-start gap-3 rounded-xl border border-ok/30 bg-ok/10 p-4 text-sm">
          <ShieldCheck size={20} className="shrink-0 text-ok" />
          <p className="text-muted">
            <b className="text-white">O app desktop tira o Discord do áudio automaticamente.</b> Todos os outros programas (jogos, música,
            navegador) vão junto com a sua tela.
          </p>
        </div>
      ) : (
        audioValue === 'system' && <DiscordAudioGuide />
      )}

      <Button variant="ghost" onClick={() => set({
        screenResolution: DEFAULT_SETTINGS.screenResolution,
        screenFps: DEFAULT_SETTINGS.screenFps,
        screenQuality: DEFAULT_SETTINGS.screenQuality,
        screenContent: DEFAULT_SETTINGS.screenContent,
        screenAudio: DEFAULT_SETTINGS.screenAudio,
      })}>
        Restaurar padrão
      </Button>
    </div>
  );
}

function AppearanceSection() {
  const { mode, lite } = useMotionMode();
  const auto = liteReason ? `Automático escolheu o leve: ${liteReason}.` : 'Automático escolheu o completo: este computador dá conta das animações.';
  return (
    <div className="space-y-5">
      <Card>
        <Field label="Animações e efeitos" hint={mode === 'auto' ? auto : undefined}>
          <Segmented<MotionMode>
            value={mode}
            onChange={setMotionMode}
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'lite', label: 'Leve' },
              { value: 'full', label: 'Completo' },
            ]}
          />
        </Field>
        <p className="mt-4 text-sm text-muted">
          {lite
            ? 'Modo leve ligado: janelas e listas aparecem sem deslizar, e o fundo, os desfoques e as sombras ficam parados. O site responde na hora mesmo sem placa de vídeo.'
            : 'Modo completo: todas as animações, desfoques e fundos em movimento. Em computadores sem placa de vídeo pode travar e pixelar.'}
        </p>
      </Card>
    </div>
  );
}

function DesktopSection() {
  const { snapshot } = useCall();
  if (desktop) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-ok/30 bg-ok/10 p-5">
          <ShieldCheck size={24} className="shrink-0 text-ok" />
          <div>
            <p className="font-semibold">Você está no app desktop</p>
            <p className="mt-1 text-sm text-muted">
              Ao transmitir com “Som do PC, sem Discord”, o Much captura o áudio de cada programa separadamente e deixa o Discord de fora.
            </p>
          </div>
        </div>
        {snapshot?.systemAudio.active && (
          <Card>
            <p className="mb-2 font-semibold">Programas sendo transmitidos agora</p>
            <div className="flex flex-wrap gap-2">
              {snapshot.systemAudio.sources.length ? (
                snapshot.systemAudio.sources.map((name) => (
                  <span key={name} className="rounded-lg bg-surface-4 px-2.5 py-1 text-sm">
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">Nenhum programa tocando som.</span>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Card>
        <p className="font-display text-lg font-semibold">Transmita o som do PC inteiro, menos o Discord</p>
        <p className="mt-2 text-sm text-muted">
          O navegador não consegue separar o áudio de um programa específico. O app desktop do Much consegue: ele captura cada
          programa separadamente e deixa o Discord de fora, sem precisar mexer nas saídas de áudio.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {['Windows 10 (versão 2004) ou mais novo', 'Mesma conta e mesmas salas do site', 'Escolha de tela ou janela específica'].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check size={16} className="text-ok" /> {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg bg-bg px-3 py-2 font-mono text-xs text-muted">cd desktop &amp;&amp; npm install &amp;&amp; npm start</p>
      </Card>
      <p className="text-sm text-muted">Sem o app? Dá para usar o navegador com o guia da seção “Transmissão de tela”.</p>
    </div>
  );
}

function AccountSection() {
  const { user, logout, updateProfile } = useAuth();
  const { openSettings } = useUi();
  const toast = useToast();
  if (!user) return null;
  const smallButton = 'rounded-lg bg-surface-4 px-3 py-1.5 text-sm font-semibold hover:bg-surface-5';
  const rows: Array<{ label: string; value: string; action: ReactNode }> = [
    {
      label: 'Nome exibido',
      value: displayName(user),
      action: (
        <button onClick={() => openSettings('profile')} className={smallButton}>
          Editar
        </button>
      ),
    },
    {
      label: 'Nick',
      value: `@${user.nick}`,
      action: (
        <button onClick={() => void navigator.clipboard?.writeText(user.nick).then(() => toast('Nick copiado', 'success'))} className={smallButton}>
          Copiar
        </button>
      ),
    },
    {
      label: 'Status',
      value: PRESENCE_INFO[user.presence].hint ?? 'Seus amigos veem que você está disponível.',
      action: (
        <select
          className="input w-44! py-1.5! text-sm"
          value={user.presence}
          onChange={(e) =>
            void updateProfile({ presence: e.target.value as Presence }).catch((err: Error) => toast(err.message, 'error'))
          }
        >
          {(Object.keys(PRESENCE_INFO) as Presence[]).map((p) => (
            <option key={p} value={p}>
              {PRESENCE_INFO[p].label}
            </option>
          ))}
        </select>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="h-28" style={{ background: coverBackground(user.banner, user.bannerImage) }} />
        <div className="flex items-end gap-4 px-5 pb-5">
          <div className="-mt-10 rounded-full bg-bg p-1.5 ring-1 ring-white/10">
            <Avatar nick={user.nick} avatar={user.avatar} image={user.avatarImage} size={84} status={visiblePresence(user.presence)} statusBg="var(--color-bg)" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate font-display text-xl font-semibold">{displayName(user)}</p>
            <p className="text-sm text-muted">@{user.nick}</p>
          </div>
          <Button onClick={() => openSettings('profile')}>
            <Pencil size={15} /> Editar perfil
          </Button>
        </div>
        <div className="mx-5 mb-5 divide-y divide-line rounded-xl bg-bg px-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wider text-muted uppercase">{row.label}</p>
                <p className={row.label === 'Status' ? 'text-sm text-muted' : 'text-[15px]'}>{row.value}</p>
              </div>
              {row.action}
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">Seu nick é como seus amigos te encontram e não pode ser alterado.</p>

      <Button variant="danger" onClick={logout}>
        <LogOut size={16} /> Sair da conta
      </Button>
    </div>
  );
}

export default function SettingsModal() {
  const { settingsSection, openSettings, closeSettings } = useUi();

  useEffect(() => {
    if (!settingsSection) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSettings();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsSection, closeSettings]);

  const current = SECTIONS.find((s) => s.id === settingsSection);
  const groups = [...new Set(SECTIONS.map((s) => s.group))];

  return (
    <AnimatePresence>
      {settingsSection && current && (
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex bg-bg"
        >
          <nav className="flex w-64 shrink-0 justify-end border-r border-line bg-surface-1 py-14 pr-3 pl-6 lg:w-80">
            <div className="w-52">
              {groups.map((group) => (
                <div key={group} className="mb-5">
                  <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-faint uppercase">{group}</p>
                  {SECTIONS.filter((s) => s.group === group).map((section) => (
                    <button
                      key={section.id}
                      onClick={() => openSettings(section.id)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] font-medium transition-colors ${
                        section.id === settingsSection ? 'text-white' : 'text-muted hover:bg-surface-3 hover:text-white'
                      }`}
                    >
                      {section.id === settingsSection && (
                        <motion.span layoutId="settings-active" className="absolute inset-0 rounded-lg bg-surface-4" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                      )}
                      <span className="relative">{section.icon}</span>
                      <span className="relative">{section.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className={`flex gap-8 px-10 py-14 ${settingsSection === 'profile' ? 'max-w-5xl' : 'max-w-3xl'}`}>
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={settingsSection}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <h1 className="mb-6 flex items-center gap-2 font-display text-2xl font-semibold">
                      {settingsSection === 'voice' && <Volume2 size={22} className="text-accent" />}
                      {current.label}
                    </h1>
                    {settingsSection === 'account' && <AccountSection />}
                    {settingsSection === 'profile' && <ProfileSection />}
                    {settingsSection === 'connections' && <ConnectionsSection />}
                    {settingsSection === 'devices' && <DevicesSection />}
                    {settingsSection === 'voice' && <VoiceSection />}
                    {settingsSection === 'video' && <VideoSection />}
                    {settingsSection === 'screen' && <ScreenSection />}
                    {settingsSection === 'appearance' && <AppearanceSection />}
                    {settingsSection === 'desktop' && <DesktopSection />}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="sticky top-0 shrink-0">
                <button
                  onClick={closeSettings}
                  className="flex flex-col items-center gap-1 text-xs font-semibold text-muted transition hover:text-white"
                  aria-label="Fechar configurações"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-current transition hover:rotate-90">
                    <X size={18} />
                  </span>
                  ESC
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
