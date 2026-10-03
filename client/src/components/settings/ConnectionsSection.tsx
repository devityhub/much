import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button, Slider, Toggle } from '../ui';
import { SpotifyLogo } from '../SpotifyBadge';
import { useToast } from '../../context/toast';
import { settingsStore, useSettings } from '../../lib/settings';
import { connectSpotify, disconnectSpotify, updateSpotifyPrefs, useSpotifyAccount } from '../../lib/spotify';

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

export default function ConnectionsSection() {
  const account = useSpotifyAccount();
  const settings = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

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
          <Button
            size="sm"
            disabled={busy || !account}
            onClick={() => void run(connectSpotify, 'Spotify conectado!')}
            className="shrink-0 bg-[#5865F2] hover:bg-[#4752c4]"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Conectar
          </Button>
        </div>
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
