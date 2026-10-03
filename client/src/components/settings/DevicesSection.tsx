import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Camera, Check, ChevronDown, Copy, Headphones, Lock, Mic, MonitorUp, RefreshCw, ShieldAlert, ShieldCheck, Speaker, X } from 'lucide-react';
import { Button } from '../ui';
import { useToast } from '../../context/toast';
import { useMediaDevices } from '../../hooks/useMediaDevices';
import { desktop } from '../../lib/desktop';
import { mediaErrorMessage } from '../../lib/mediaErrors';
import { settingsStore, useSettings } from '../../lib/settings';

type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

function usePermission(name: 'microphone' | 'camera') {
  const [state, setState] = useState<PermState>('prompt');
  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported');
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName });
      setState(status.state);
      status.onchange = () => setState(status.state);
    } catch {
      // Firefox não informa o estado da câmera/microfone: descobrimos ao pedir.
      setState('prompt');
    }
  }, [name]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return [state, setState, refresh] as const;
}

function useNotificationPermission() {
  const supported = typeof Notification !== 'undefined';
  const [state, setState] = useState<PermState>(supported ? (Notification.permission === 'default' ? 'prompt' : Notification.permission) : 'unsupported');
  const request = async () => {
    const result = await Notification.requestPermission();
    setState(result === 'default' ? 'prompt' : result);
  };
  return [state, request] as const;
}

const BADGE: Record<PermState, { label: string; className: string }> = {
  granted: { label: 'Permitido', className: 'bg-ok/15 text-ok' },
  denied: { label: 'Bloqueado', className: 'bg-danger/15 text-danger' },
  prompt: { label: 'Ainda não permitido', className: 'bg-warn/15 text-warn' },
  unsupported: { label: 'Indisponível', className: 'bg-surface-5 text-muted' },
};

function BlockedHelp({ what }: { what: string }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <ol className="mt-3 list-decimal space-y-1 rounded-xl bg-bg p-4 pl-8 text-sm text-muted">
        <li>
          Clique no <Lock size={13} className="inline -translate-y-px" /> <b className="text-white">cadeado</b> (ou no ícone de ajustes) à esquerda do endereço do site.
        </li>
        <li>
          Em <b className="text-white">{what}</b>, escolha <b className="text-white">Permitir</b>.
        </li>
        <li>Recarregue a página (F5).</li>
        <li>
          Ainda não foi? No Windows, abra <b className="text-white">Configurações → Privacidade → {what}</b> e ative o acesso para o navegador.
        </li>
      </ol>
    </motion.div>
  );
}

function PermissionRow({
  icon,
  title,
  description,
  state,
  onRequest,
  what,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  state: PermState;
  onRequest: () => void;
  what: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const badge = BADGE[state];
  return (
    <div className="border-b border-line py-4 last:border-0">
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-4 text-muted">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {title}
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
          </p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {state === 'prompt' && (
          <Button size="sm" onClick={onRequest}>
            Permitir
          </Button>
        )}
        {state === 'granted' && <Check size={20} className="text-ok" />}
        {state === 'denied' && (
          <Button size="sm" variant="secondary" onClick={() => setHelpOpen((v) => !v)}>
            Como liberar <ChevronDown size={14} className={`transition ${helpOpen ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>
      <AnimatePresence>{state === 'denied' && helpOpen && <BlockedHelp what={what} />}</AnimatePresence>
    </div>
  );
}

function DeviceGroup({
  icon,
  title,
  devices,
  selectedId,
  onSelect,
  fallback,
}: {
  icon: ReactNode;
  title: string;
  devices: MediaDeviceInfo[];
  selectedId: string;
  onSelect?: (id: string) => void;
  fallback: string;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
        {icon} {title} <span className="text-faint">· {devices.length}</span>
      </p>
      <div className="space-y-1.5">
        {devices.map((d, i) => {
          const selected = d.deviceId === selectedId;
          return (
            <motion.div
              key={d.deviceId}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${selected ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface-2'}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${selected ? 'bg-accent' : 'bg-ok'}`} />
              <span className="min-w-0 flex-1 truncate">{d.label || `${fallback} ${i + 1} (permita o acesso para ver o nome)`}</span>
              {onSelect &&
                (selected ? (
                  <span className="text-xs font-semibold text-accent">Em uso</span>
                ) : (
                  <button onClick={() => onSelect(d.deviceId)} className="text-xs font-semibold text-muted hover:text-white">
                    Usar este
                  </button>
                ))}
            </motion.div>
          );
        })}
        {!devices.length && <p className="rounded-xl border border-dashed border-line px-3 py-3 text-sm text-faint">Nenhum encontrado. Conecte e clique em atualizar.</p>}
      </div>
    </div>
  );
}

function InsecureOriginCard() {
  const toast = useToast();
  const origin = window.location.origin;
  const localUrl = `http://localhost${window.location.port ? `:${window.location.port}` : ''}`;
  const copy = (text: string) => void navigator.clipboard?.writeText(text).then(() => toast('Copiado', 'success'));
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
      <p className="flex items-center gap-2 font-semibold text-danger">
        <ShieldAlert size={20} /> Conexão não segura: microfone, câmera e tela estão bloqueados
      </p>
      <p className="mt-2 text-sm text-muted">
        Você abriu o Much por <b className="text-white">{origin}</b>. Os navegadores só liberam microfone, câmera e transmissão de tela em
        endereços <b className="text-white">https://</b> ou em <b className="text-white">localhost</b>. Escolha uma das opções:
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-xl bg-bg p-3">
          <p className="font-semibold">1. No computador que roda o servidor</p>
          <p className="text-muted">
            Abra <b className="text-white">{localUrl}</b>.
          </p>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <p className="font-semibold">2. Em outros computadores da rede (recomendado)</p>
          <p className="text-muted">
            Inicie o site com HTTPS usando <code className="rounded bg-surface-4 px-1.5 py-0.5 text-white">npm run dev:https</code> e acesse{' '}
            <b className="text-white">https://IP-DO-SERVIDOR:5173</b>. Na primeira vez, clique em “Avançado → Continuar” no aviso do certificado.
          </p>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <p className="font-semibold">3. Liberar este endereço no Chrome/Edge</p>
          <p className="text-muted">
            Abra <b className="text-white">chrome://flags/#unsafely-treat-insecure-origin-as-secure</b> (no Edge, edge://flags/...), cole o endereço
            abaixo, ative e reinicie o navegador.
          </p>
          <button onClick={() => copy(origin)} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-surface-4 px-3 py-1.5 font-mono text-xs hover:bg-surface-5">
            {origin} <Copy size={13} />
          </button>
        </div>
        <div className="rounded-xl bg-bg p-3">
          <p className="font-semibold">4. App desktop</p>
          <p className="text-muted">O app desktop do Much já libera o servidor da rede local automaticamente.</p>
        </div>
      </div>
    </div>
  );
}

function Capability({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-ok/20 text-ok' : 'bg-surface-5 text-muted'}`}>
        {ok ? <Check size={13} /> : <X size={13} />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </div>
  );
}

export default function DevicesSection() {
  const toast = useToast();
  const s = useSettings();
  const devices = useMediaDevices();
  const [mic, setMic, refreshMic] = usePermission('microphone');
  const [cam, setCam, refreshCam] = usePermission('camera');
  const [notif, requestNotif] = useNotificationPermission();
  const [refreshing, setRefreshing] = useState(false);

  const secure = window.isSecureContext;
  const ua = navigator.userAgent;
  const chromium = /Chrome|Edg\//.test(ua);
  const windows = /Windows/.test(ua);

  const request = async (kind: 'audio' | 'video') => {
    try {
      await devices.requestAccess(kind);
      (kind === 'audio' ? setMic : setCam)('granted');
      toast(kind === 'audio' ? 'Microfone liberado' : 'Câmera liberada', 'success');
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError') (kind === 'audio' ? setMic : setCam)('denied');
      toast(mediaErrorMessage(err, kind === 'audio' ? 'microfone' : 'câmera') ?? 'Não foi possível acessar o dispositivo', 'error');
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([devices.refresh(), refreshMic(), refreshCam()]);
    window.setTimeout(() => setRefreshing(false), 500);
  };

  const problem =
    mic === 'denied'
      ? 'O microfone está bloqueado. Veja abaixo como liberar.'
      : mic !== 'granted'
        ? 'Permita o microfone para poder falar.'
        : !devices.audioinput.length
          ? 'Nenhum microfone encontrado. Conecte um fone ou microfone e clique em atualizar.'
          : null;
  const allGood = secure && !problem;

  return (
    <div className="space-y-6">
      {!secure ? (
        <InsecureOriginCard />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 rounded-2xl border p-4 ${allGood ? 'border-ok/30 bg-ok/10' : 'border-warn/30 bg-warn/10'}`}
        >
          {allGood ? <ShieldCheck size={22} className="shrink-0 text-ok" /> : <ShieldAlert size={22} className="shrink-0 text-warn" />}
          <div className="text-sm">
            <p className="font-semibold">{problem ?? 'Tudo pronto para falar e transmitir'}</p>
            <p className="text-muted">
              {desktop ? 'App desktop: as permissões são liberadas automaticamente.' : `Conexão segura (${window.location.origin}).`}
            </p>
          </div>
        </motion.div>
      )}

      <div className="rounded-2xl border border-line bg-surface-1 px-5">
        <PermissionRow
          icon={<Mic size={19} />}
          title="Microfone"
          description="Para falar nas salas e chamadas."
          state={secure ? mic : 'unsupported'}
          onRequest={() => void request('audio')}
          what="Microfone"
        />
        <PermissionRow
          icon={<Camera size={19} />}
          title="Câmera"
          description="Para ligar o vídeo."
          state={secure ? cam : 'unsupported'}
          onRequest={() => void request('video')}
          what="Câmera"
        />
        <PermissionRow
          icon={<Bell size={19} />}
          title="Notificações"
          description="Avisa de chamadas e pedidos de amizade quando o Much está em segundo plano."
          state={notif}
          onRequest={() => void requestNotif()}
          what="Notificações"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Dispositivos encontrados</h2>
          <Button variant="secondary" size="sm" onClick={() => void refreshAll()}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </Button>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <DeviceGroup
            icon={<Mic size={14} />}
            title="Microfones"
            devices={devices.audioinput}
            selectedId={s.audioInputId}
            onSelect={(id) => settingsStore.set({ audioInputId: id })}
            fallback="Microfone"
          />
          <DeviceGroup
            icon={<Camera size={14} />}
            title="Câmeras"
            devices={devices.videoinput}
            selectedId={s.videoInputId}
            onSelect={(id) => settingsStore.set({ videoInputId: id })}
            fallback="Câmera"
          />
          <DeviceGroup
            icon={<Headphones size={14} />}
            title="Saídas de áudio"
            devices={devices.audiooutput}
            selectedId={s.audioOutputId}
            onSelect={'setSinkId' in HTMLMediaElement.prototype ? (id) => settingsStore.set({ audioOutputId: id }) : undefined}
            fallback="Saída"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">O que este navegador suporta</h2>
        <div className="grid gap-2.5 md:grid-cols-2">
          <Capability
            ok={secure && typeof navigator.mediaDevices?.getDisplayMedia === 'function'}
            label="Transmitir tela"
            hint="Chrome, Edge, Firefox e o app desktop."
          />
          <Capability
            ok={Boolean(desktop) || (secure && chromium && windows)}
            label={desktop ? 'Som do PC sem Discord' : 'Som do PC inteiro'}
            hint={desktop ? 'Captura por programa, deixando o Discord de fora.' : 'Só Chrome/Edge no Windows. Veja o guia em Transmissão de tela.'}
          />
          <Capability ok={'setSinkId' in HTMLMediaElement.prototype} label="Escolher saída de áudio" hint="Mandar as vozes para o fone ou caixa que você quiser." />
          <Capability ok={typeof RTCPeerConnection !== 'undefined'} label="Chamadas (WebRTC)" hint="Voz, câmera e tela direto entre vocês." />
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-faint">
        <Speaker size={14} /> <MonitorUp size={14} /> Dispositivos conectados depois de abrir o Much aparecem sozinhos na lista.
      </p>
    </div>
  );
}
