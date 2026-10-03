import { useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, Info, Loader2, Settings2 } from 'lucide-react';
import { Button, Slider, Toggle } from '../ui';
import { SpotifyLogo } from '../SpotifyBadge';
import { useToast } from '../../context/toast';
import { canCaptureSpotify, desktop } from '../../lib/desktop';
import { settingsStore, useSettings } from '../../lib/settings';
import { clearSpotifyConfig, connectSpotify, disconnectSpotify, saveSpotifyConfig, useSpotifyAccount } from '../../lib/spotify';
import { canCaptureTab } from '../../lib/tabAudio';
import type { SpotifyAccount } from '../../lib/types';

const DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-bold">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Uma vez por servidor: cadastra o app Spotify (igual o Discord ter as chaves no backend). */
function SpotifySetup({ account, onDone }: { account: SpotifyAccount; onDone: () => void }) {
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyRedirect = () => {
    void navigator.clipboard?.writeText(account.redirectUri).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => toast('Não deu para copiar. Selecione e copie na mão.', 'error'),
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveSpotifyConfig(clientId.trim(), clientSecret.trim());
      onDone();
      await connectSpotify();
      toast('Spotify conectado!', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line p-5">
      <p className="mb-4 text-sm text-muted">
        Isso é configuração do servidor (uma vez). Depois cada pessoa só clica em <span className="font-semibold text-white/80">Conectar Spotify</span>.
      </p>
      <ol className="space-y-4">
        <Step n={1} title="Crie um app no painel do Spotify">
          <p className="mt-0.5 text-sm text-muted">Grátis — conta Free ou Premium.</p>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-surface-4 px-3 py-1.5 text-sm font-semibold transition hover:bg-surface-5"
          >
            <ExternalLink size={14} /> Abrir developer.spotify.com
          </a>
        </Step>

        <Step n={2} title="Cole este endereço em “Redirect URIs”">
          <div className="mt-2 flex gap-2">
            <input readOnly value={account.redirectUri} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
            <Button variant="secondary" onClick={copyRedirect} className="shrink-0">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </Step>

        <Step n={3} title="Cole Client ID e Client Secret">
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              className="input font-mono text-xs"
              placeholder="Client ID"
              autoComplete="off"
              spellCheck={false}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <input
              className="input font-mono text-xs"
              type="password"
              placeholder="Client Secret"
              autoComplete="new-password"
              spellCheck={false}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <Button disabled={busy || !clientId.trim() || !clientSecret.trim()} onClick={() => void save()} className="mt-3">
            {busy && <Loader2 size={16} className="animate-spin" />} Salvar e conectar
          </Button>
        </Step>
      </ol>
    </div>
  );
}

export default function ConnectionsSection() {
  const account = useSpotifyAccount();
  const settings = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false);
  const showSetup = Boolean(account?.canConfigure && (setup || !account.configured));

  const run = async (job: () => Promise<unknown>, done: string, tone: 'success' | 'info' = 'success') => {
    setBusy(true);
    try {
      await job();
      toast(done, tone);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
        <div className="flex items-center gap-4 bg-linear-to-r from-[#1db954]/25 to-transparent p-5">
          <SpotifyLogo size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold">Spotify</p>
            {!account ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : account.linked ? (
              <p className="flex items-center gap-1.5 text-sm text-ok">
                <Check size={15} /> Conectado como <span className="font-semibold">{account.name}</span>
                {account.premium ? ' · Premium' : ' · Free'}
              </p>
            ) : account.configured ? (
              <p className="text-sm text-muted">Conecte sua conta — amigos veem o que você está ouvindo, como no Discord.</p>
            ) : account.canConfigure ? (
              <p className="text-sm text-muted">Configure o app do Spotify uma vez neste servidor. Depois é só conectar a conta.</p>
            ) : (
              <p className="text-sm text-muted">Alguém ainda precisa configurar o Spotify do servidor em Conexões.</p>
            )}
          </div>
          {account?.configured &&
            (account.linked ? (
              <Button variant="secondary" disabled={busy} onClick={() => void run(disconnectSpotify, 'Spotify desconectado', 'info')}>
                Desconectar
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void run(connectSpotify, 'Spotify conectado!')}>
                {busy && <Loader2 size={16} className="animate-spin" />} Conectar Spotify
              </Button>
            ))}
          {!account?.configured && account?.canConfigure && !showSetup && (
            <Button disabled={busy} onClick={() => setSetup(true)}>
              Configurar
            </Button>
          )}
        </div>

        {account && showSetup && <SpotifySetup account={account} onDone={() => setSetup(false)} />}

        {account?.canConfigure && account.configured && !setup && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setSetup(true)}>
              <Settings2 size={14} /> Trocar chaves do servidor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Remover as chaves do app do Spotify? Todo mundo deste servidor vai desconectar.')) {
                  void run(clearSpotifyConfig, 'Chaves do Spotify removidas', 'info');
                }
              }}
            >
              Remover chaves
            </Button>
          </div>
        )}

        <ul className="space-y-2 border-t border-line p-5 text-sm text-muted">
          <li>
            • Clique em <span className="font-semibold text-white/80">Conectar Spotify</span>, faça login e autorize — fica{' '}
            <span className="font-semibold text-ok">Conectado</span> na sua conta do Much.
          </li>
          <li>• Amigos passam a ver a música que você está ouvindo no perfil (só vitrine, como no Discord).</li>
          <li>
            • Na sala, o botão verde compartilha o áudio (aba do Spotify no Chrome/Edge, ou app desktop) para todo mundo ouvir junto.
          </li>
        </ul>
        {account?.fromEnv && (
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-sm text-faint">
            <Info size={16} /> As chaves vêm do .env deste servidor.
          </p>
        )}
        {desktop && !canCaptureSpotify && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Seu app desktop é antigo. Atualize para tocar música do Spotify na sala.
          </p>
        )}
        {!desktop && !canCaptureTab && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Este navegador não compartilha áudio de abas. Use Chrome, Edge ou o app desktop para ser DJ.
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
