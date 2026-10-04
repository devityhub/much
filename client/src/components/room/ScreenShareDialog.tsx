import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppWindow, Download, Globe, Monitor, RefreshCw, Settings2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { Button } from '../ui';
import { desktop, type DesktopSource } from '../../lib/desktop';
import type { ScreenShareOptions } from '../../lib/roomClient';
import { settingsStore, useSettings, type ScreenAudioMode } from '../../lib/settings';
import { useUi } from '../../context/ui';

interface ScreenShareDialogProps {
  onClose: () => void;
  onStart: (options: ScreenShareOptions) => void;
}

interface AudioOption {
  value: ScreenAudioMode;
  icon: ReactNode;
  title: string;
  hint: string;
  badge?: string;
}

function AudioChoice({ options, value, onChange }: { options: AudioOption[]; value: ScreenAudioMode; onChange: (v: ScreenAudioMode) => void }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
            value === option.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface-3 hover:border-white/20'
          }`}
        >
          <span className={`mt-0.5 ${value === option.value ? 'text-accent' : 'text-muted'}`}>{option.icon}</span>
          <span className="flex-1">
            <span className="flex items-center gap-2 font-semibold">
              {option.title}
              {option.badge && <span className="rounded-md bg-ok/15 px-1.5 py-0.5 text-[10px] font-bold text-ok uppercase">{option.badge}</span>}
            </span>
            <span className="mt-0.5 block text-sm text-muted">{option.hint}</span>
          </span>
          <span
            className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
              value === option.value ? 'border-accent' : 'border-faint'
            }`}
          >
            {value === option.value && <motion.span layoutId="audio-dot" className="h-2 w-2 rounded-full bg-accent" />}
          </span>
        </button>
      ))}
    </div>
  );
}

export function DiscordAudioGuide() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
      <p className="font-semibold text-warn">Como tirar o Discord do áudio no navegador</p>
      <p className="mt-1 text-muted">
        O navegador captura tudo o que toca na <b className="text-white">saída de áudio padrão do Windows</b>. Então basta o Discord tocar em
        outra saída:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>
          No Discord: <b className="text-white">Configurações → Voz e vídeo → Dispositivo de saída</b> e escolha um dispositivo que{' '}
          <b className="text-white">não</b> seja o padrão (ex.: o fone, se o padrão é a caixa de som).
        </li>
        <li>Deixe jogos, música e vídeos na saída padrão do Windows.</li>
        <li>
          Ao transmitir, escolha <b className="text-white">Tela inteira</b> e marque <b className="text-white">“Compartilhar áudio do sistema”</b>.
        </li>
      </ol>
      <p className="mt-2 text-muted">
        Só tem uma saída de áudio? Use o <b className="text-white">app desktop do PassTime</b>, que remove o Discord automaticamente.
      </p>
    </div>
  );
}

function DesktopPicker({ onStart }: Pick<ScreenShareDialogProps, 'onStart'>) {
  const settings = useSettings();
  const [sources, setSources] = useState<DesktopSource[] | null>(null);
  const [tab, setTab] = useState<'screen' | 'window'>('screen');
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const audio: ScreenAudioMode = settings.screenAudio === 'none' ? 'none' : 'system';

  const load = useCallback(async () => {
    try {
      setSources(await desktop!.listSources());
      setError('');
    } catch (err) {
      setError((err as Error).message);
      setSources([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = (sources ?? []).filter((s) => s.kind === tab);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          {(['screen', 'window'] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => setTab(kind)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                tab === kind ? 'bg-white text-black' : 'bg-surface-4 hover:bg-surface-5'
              }`}
            >
              {kind === 'screen' ? <Monitor size={16} /> : <AppWindow size={16} />}
              {kind === 'screen' ? 'Telas' : 'Janelas'}
            </button>
          ))}
          <button onClick={() => void load()} className="ml-auto rounded-lg p-2 text-muted hover:bg-surface-4 hover:text-white" aria-label="Atualizar lista">
            <RefreshCw size={18} />
          </button>
        </div>

        {!sources ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {visible.map((source, i) => (
              <motion.button
                key={source.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(source.id)}
                onDoubleClick={() => onStart({ sourceId: source.id, audio })}
                className={`overflow-hidden rounded-xl bg-black text-left ring-2 transition ${
                  selected === source.id ? 'ring-accent' : 'ring-transparent hover:ring-white/30'
                }`}
              >
                <img src={source.thumbnail} alt="" className="aspect-video w-full object-contain" />
                <div className="flex items-center gap-2 bg-surface-3 px-2.5 py-2 text-xs">
                  {source.appIcon && <img src={source.appIcon} alt="" className="h-4 w-4" />}
                  <span className="truncate">{source.name}</span>
                </div>
              </motion.button>
            ))}
            {!visible.length && <p className="col-span-full py-6 text-center text-muted">Nada encontrado.</p>}
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-bold tracking-wider text-muted uppercase">Áudio</p>
        <AudioChoice
          value={audio}
          onChange={(v) => settingsStore.set({ screenAudio: v })}
          options={[
            {
              value: 'system',
              icon: <ShieldCheck size={18} />,
              title: 'Som do PC, sem Discord',
              hint: 'Todos os programas, menos o Discord e o próprio PassTime. Windows 10 2004+.',
              badge: 'recomendado',
            },
            { value: 'none', icon: <VolumeX size={18} />, title: 'Sem áudio', hint: 'Transmite só a imagem.' },
          ]}
        />
        <QualitySummary />
        <Button className="mt-auto w-full" size="lg" disabled={!selected} onClick={() => selected && onStart({ sourceId: selected, audio })}>
          <Monitor size={18} /> Transmitir
        </Button>
      </div>
    </div>
  );
}

function QualitySummary() {
  const s = useSettings();
  const { openSettings } = useUi();
  const resolution = s.screenResolution === 'native' ? 'Nativa' : `${s.screenResolution}p`;
  const quality = { economy: 'Econômica', balanced: 'Equilibrada', high: 'Alta' }[s.screenQuality];
  return (
    <button
      onClick={() => openSettings('screen')}
      className="flex items-center justify-between rounded-xl bg-surface-3 px-3.5 py-3 text-left text-sm transition hover:bg-surface-4"
    >
      <span>
        <span className="block font-semibold">
          {resolution} · {s.screenFps} fps
        </span>
        <span className="text-muted">Qualidade {quality}</span>
      </span>
      <Settings2 size={18} className="text-muted" />
    </button>
  );
}

function BrowserPicker({ onStart }: Pick<ScreenShareDialogProps, 'onStart'>) {
  const settings = useSettings();
  const audio = settings.screenAudio;
  const supported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  return (
    <div className="space-y-4">
      {!supported && (
        <p className="rounded-xl bg-warn/15 px-4 py-3 text-sm text-warn">
          Seu navegador não permite compartilhar a tela aqui. Use Chrome ou Edge atualizado e acesse por HTTPS (ou localhost).
        </p>
      )}

      <AudioChoice
        value={audio}
        onChange={(v) => settingsStore.set({ screenAudio: v })}
        options={[
          {
            value: 'system',
            icon: <Volume2 size={18} />,
            title: 'Som do PC inteiro',
            hint: 'Tudo que toca na saída padrão do Windows. Coloque o Discord em outra saída (guia abaixo).',
          },
          { value: 'tab', icon: <Globe size={18} />, title: 'Som de uma aba', hint: 'Só o áudio de uma aba do Chrome/Edge (ex.: um filme).' },
          { value: 'none', icon: <VolumeX size={18} />, title: 'Sem áudio', hint: 'Transmite só a imagem.' },
        ]}
      />

      <AnimatePresence initial={false}>
        {audio === 'system' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <DiscordAudioGuide />
          </motion.div>
        )}
      </AnimatePresence>

      <QualitySummary />

      <div className="flex gap-3">
        <Button className="flex-1" size="lg" disabled={!supported} onClick={() => onStart({ audio })}>
          <Monitor size={18} /> Escolher o que transmitir
        </Button>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        <Download size={14} /> O app desktop do PassTime tira o Discord do áudio sozinho, sem precisar configurar nada.
      </p>
    </div>
  );
}

export default function ScreenShareDialog({ onClose, onStart }: ScreenShareDialogProps) {
  return (
    <Modal
      title="Transmitir tela"
      subtitle={desktop ? 'Escolha uma tela ou janela.' : 'O navegador vai perguntar o que transmitir.'}
      onClose={onClose}
      wide={Boolean(desktop)}
    >
      {desktop ? <DesktopPicker onStart={onStart} /> : <BrowserPicker onStart={onStart} />}
    </Modal>
  );
}
