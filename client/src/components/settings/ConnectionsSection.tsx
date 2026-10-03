import { Info } from 'lucide-react';
import { Slider, Toggle } from '../ui';
import { SpotifyLogo } from '../SpotifyBadge';
import { canCaptureSpotify, desktop } from '../../lib/desktop';
import { settingsStore, useSettings } from '../../lib/settings';
import { canCaptureTab } from '../../lib/tabAudio';

export default function ConnectionsSection() {
  const settings = useSettings();

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="flex items-center gap-4 bg-linear-to-r from-[#1db954]/25 to-transparent p-5">
          <SpotifyLogo size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">Spotify</p>
            <p className="text-sm text-muted">Sem login. Na sala, um clique compartilha o que está tocando.</p>
          </div>
        </div>

        <ul className="space-y-2 border-t border-line p-5 text-sm text-muted">
          <li>
            • Abra o <span className="font-mono text-xs text-white/70">open.spotify.com</span> (ou o app Spotify no desktop) e deixe a música
            tocando.
          </li>
          <li>
            • Na sala/chamada, clique no botão verde do Spotify. No navegador, escolha a aba do Spotify com{' '}
            <span className="font-semibold text-white/80">Compartilhar áudio da aba</span> ligado.
          </li>
          <li>• Pronto — todo mundo na sala escuta. Clique de novo para parar.</li>
        </ul>

        {desktop && !canCaptureSpotify && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Seu app desktop é antigo. Atualize para tocar música do Spotify.
          </p>
        )}
        {!desktop && !canCaptureTab && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Este navegador não compartilha o áudio de abas. Use o Chrome, o Edge ou o app desktop.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <p className="mb-1 font-semibold">Música dos outros nas salas</p>
        <p className="mb-4 text-sm text-muted">Vale para qualquer DJ. Também dá para mutar pelo botão do Spotify na chamada.</p>
        <Toggle label="Mutar a música do Spotify" checked={settings.musicMuted} onChange={(v) => settingsStore.set({ musicMuted: v })} />
        <div className={`mt-4 ${settings.musicMuted ? 'opacity-40' : ''}`}>
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
