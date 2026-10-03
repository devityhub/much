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

/** Cadastro das chaves do app do Spotify, feito pelo dono do servidor sem mexer no .env. */
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
      // Com as chaves no lugar, já emenda no login do Spotify para não precisar de outro clique.
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
      <ol className="space-y-4">
        <Step n={1} title="Crie um app no painel do Spotify">
          <p className="mt-0.5 text-sm text-muted">É grátis e serve para qualquer conta Spotify, até a Free.</p>
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
          <p className="mt-0.5 text-sm text-muted">
            Tem que ser idêntico (copie o campo abaixo). Em Settings do app, marque “Web API”. Se o link do Much mudar, atualize este URI no painel do
            Spotify.
          </p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={account.redirectUri} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
            <Button variant="secondary" onClick={copyRedirect} className="shrink-0">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </Step>

        <Step n={3} title="Traga o Client ID e o Client Secret para cá">
          <p className="mt-0.5 text-sm text-muted">Ficam em “Settings” do app que você criou. Valem para todo mundo deste servidor.</p>
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
              <p className="text-sm text-muted">Conecte sua conta para aparecer “Conectado” e compartilhar música nas salas.</p>
            ) : account.canConfigure ? (
              <p className="text-sm text-muted">Primeiro cadastre o app do Spotify (3 passos abaixo). Depois é só conectar a conta.</p>
            ) : (
              <p className="text-sm text-muted">Alguém ainda precisa cadastrar o app do Spotify em Conexões.</p>
            )}
          </div>
          {account?.configured &&
            (account.linked ? (
              <Button variant="secondary" disabled={busy} onClick={() => void run(disconnectSpotify, 'Spotify desconectado', 'info')}>
                Desconectar
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void run(connectSpotify, 'Spotify conectado!')}>
                {busy && <Loader2 size={16} className="animate-spin" />} Conectar a conta
              </Button>
            ))}
        </div>

        {account && showSetup && <SpotifySetup account={account} onDone={() => setSetup(false)} />}

        {account?.canConfigure && account.configured && !setup && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
            <Button variant="ghost" size="sm" onClick={() => setSetup(true)}>
              <Settings2 size={14} /> Trocar as chaves do app
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
            • <span className="font-semibold text-white/80">1.</span> Cadastre o app (se ainda não tiver) →{' '}
            <span className="font-semibold text-white/80">2.</span> Clique em <span className="font-semibold text-white/80">Conectar a conta</span> e
            faça login no Spotify → aparece <span className="font-semibold text-ok">Conectado</span>.
          </li>
          <li>
            • <span className="font-semibold text-white/80">3.</span> Na sala/chamada, clique no botão verde do Spotify para compartilhar: todos
            escutam o que toca no seu Spotify.
          </li>
          <li>
            • No Chrome/Edge: abra <span className="font-mono text-xs text-white/70">open.spotify.com</span> em outra aba e, no seletor, escolha essa
            aba com “Compartilhar áudio da aba” ligado.
          </li>
          <li>• Só o DJ controla (pausar/pular/buscar — Premium). Os outros mutam ou baixam o volume.</li>
          <li>• A música que você ouve também aparece no perfil para amigos (só vitrine).</li>
        </ul>
        {account?.fromEnv && (
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-sm text-faint">
            <Info size={16} /> As chaves vêm do .env deste servidor, então não dá para trocá-las por aqui.
          </p>
        )}
        {desktop && !canCaptureSpotify && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Seu app desktop é antigo. Atualize para tocar música do Spotify.
          </p>
        )}
        {!desktop && !canCaptureTab && (
          <p className="flex items-center gap-2 border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">
            <Info size={16} /> Este navegador não compartilha o áudio de abas. Para ser DJ, use o Chrome, o Edge ou o app desktop.
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
