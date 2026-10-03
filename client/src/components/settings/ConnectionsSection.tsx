import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react';
import { Button, Slider, Toggle } from '../ui';
import { SpotifyLogo } from '../SpotifyBadge';
import { useToast } from '../../context/toast';
import { settingsStore, useSettings } from '../../lib/settings';
import {
  connectSpotify,
  disconnectSpotify,
  saveSpotifyConfig,
  updateSpotifyPrefs,
  useSpotifyAccount,
} from '../../lib/spotify';

/** Interruptor azul no estilo Discord. */
function DiscordToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-6 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="text-sm font-medium text-white/90">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#5865F2]' : 'bg-[#4e5058]'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left,right] ${checked ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
    </label>
  );
}

/** Desbloqueio único do servidor — sem tutorial longo. Depois é só login Spotify. */
function UnlockSpotify({
  redirectUri,
  onDone,
  onCancel,
}: {
  redirectUri: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(redirectUri).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => toast('Não deu para copiar', 'error'),
    );
  };

  const save = async () => {
    // Popup no mesmo clique — senão o navegador bloqueia o login do Spotify.
    const popup = window.open('about:blank', 'much-spotify', 'width=520,height=780,noopener=no');
    setBusy(true);
    try {
      await saveSpotifyConfig(clientId.trim(), clientSecret.trim());
      await connectSpotify(popup);
      toast('Spotify conectado!', 'success');
      onDone();
    } catch (err) {
      popup?.close();
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onMouseDown={onCancel}>
      <div
        className="w-full max-w-md rounded-xl bg-[#1e1f22] p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <SpotifyLogo size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">Liberar Spotify neste Much</p>
            <p className="text-sm text-muted">Só uma vez. Depois todo mundo só clica em Conectar e faz login na conta.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <a
          href="https://developer.spotify.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5865F2] hover:underline"
        >
          <ExternalLink size={14} /> Criar app grátis no Spotify
        </a>

        <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Redirect URI (cole no app)</p>
        <div className="mb-3 flex gap-2">
          <input readOnly value={redirectUri} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
          <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>

        <div className="mb-4 grid gap-2">
          <input
            className="input font-mono text-sm"
            placeholder="Client ID"
            autoComplete="off"
            spellCheck={false}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <input
            className="input font-mono text-sm"
            type="password"
            placeholder="Client Secret"
            autoComplete="new-password"
            spellCheck={false}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>

        <Button
          disabled={busy || !clientId.trim() || !clientSecret.trim()}
          onClick={() => void save()}
          className="w-full bg-[#5865F2] hover:bg-[#4752c4]"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          Salvar e conectar conta
        </Button>
      </div>
    </div>
  );
}

export default function ConnectionsSection() {
  const account = useSpotifyAccount();
  const settings = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [unlock, setUnlock] = useState(false);

  const run = async (job: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await job();
      if (done) toast(done, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onConnect = () => {
    if (!account) return;
    if (!account.configured) {
      setUnlock(true);
      return;
    }
    void run(connectSpotify, 'Spotify conectado!');
  };

  const linked = Boolean(account?.linked);
  const count = linked ? 1 : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{count === 1 ? '1 conexão' : `${count} conexões`}</p>

      {linked && account ? (
        <div className="rounded-xl bg-[#1e1f22] p-4">
          <div className="flex items-start gap-3">
            <SpotifyLogo size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{account.name || 'Spotify'}</p>
                  <p className="text-sm text-muted">Spotify</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(disconnectSpotify)}
                  className="rounded-md p-1 text-muted transition hover:bg-white/10 hover:text-white"
                  aria-label="Desconectar Spotify"
                  title="Desconectar"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={18} />}
                </button>
              </div>

              <div className="mt-2 border-t border-white/10">
                <DiscordToggle
                  label="Exibir no perfil"
                  checked={account.showOnProfile}
                  disabled={busy}
                  onChange={(showOnProfile) => void run(() => updateSpotifyPrefs({ showOnProfile }))}
                />
                <DiscordToggle
                  label="Exibir o Spotify como seu status"
                  checked={account.showAsStatus}
                  disabled={busy}
                  onChange={(showAsStatus) => void run(() => updateSpotifyPrefs({ showAsStatus }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-[#1e1f22] p-4">
          <SpotifyLogo size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">Spotify</p>
            <p className="text-sm text-muted">Mostre o que você está ouvindo no perfil e no status</p>
          </div>
          <Button size="sm" disabled={busy || !account} onClick={onConnect} className="shrink-0 bg-[#5865F2] hover:bg-[#4752c4]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Conectar
          </Button>
        </div>
      )}

      {unlock && account && (
        <UnlockSpotify redirectUri={account.redirectUri} onDone={() => setUnlock(false)} onCancel={() => setUnlock(false)} />
      )}

      <div className="rounded-xl bg-[#1e1f22] p-4">
        <p className="mb-1 text-sm font-semibold">Música dos outros nas salas</p>
        <p className="mb-2 text-xs text-muted">Quando alguém compartilha o Spotify na chamada.</p>
        <Toggle label="Mutar a música do Spotify" checked={settings.musicMuted} onChange={(v) => settingsStore.set({ musicMuted: v })} />
        <div className={`mt-2 ${settings.musicMuted ? 'opacity-40' : ''}`}>
          <div className="mb-2 flex justify-between text-sm">
            <span>Volume da música</span>
            <span className="text-muted">{Math.round(settings.musicVolume * 100)}%</span>
          </div>
          <Slider value={settings.musicVolume} onChange={(v) => settingsStore.set({ musicVolume: v })} />
        </div>
      </div>
    </div>
  );
}
