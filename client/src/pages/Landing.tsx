import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  Download,
  Headphones,
  MicOff,
  MonitorUp,
  PhoneCall,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';
import { SpotifyLogo } from '../components/SpotifyBadge';

const NAV = [
  { href: '#salas', label: 'Salas' },
  { href: '#transmitir', label: 'Transmitir' },
  { href: '#voz', label: 'Voz e texto' },
  { href: '#spotify', label: 'Spotify' },
  { href: '#amigos', label: 'Amigos' },
  { href: '#baixar', label: 'Baixar' },
];

const FEATURES = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Som do PC, sem o Discord',
    text: 'Jogo, música, vídeo: tudo vai junto com a sua tela. O Discord fica de fora, sem eco da call.',
  },
  {
    icon: <PhoneCall size={22} />,
    title: 'Amigos e chamadas privadas',
    text: 'Adicione pelo nick e ligue direto. Voz, câmera e tela só entre vocês dois.',
  },
  {
    icon: <Users size={22} />,
    title: 'Salas públicas',
    text: 'Entre e saia como num canal de voz. Veja quem está falando e quem está ao vivo.',
  },
  {
    icon: <SlidersHorizontal size={22} />,
    title: 'Tudo configurável',
    text: 'Microfone, fone, câmera, resolução, fps e qualidade da transmissão, do seu jeito.',
  },
];

function EqBars() {
  return (
    <div className="flex h-4 items-end gap-0.5">
      {[0, 0.2, 0.4, 0.1].map((delay) => (
        <span key={delay} className="eq-bar w-1 rounded-full bg-ok" style={{ height: '100%', animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

function LiveDot() {
  return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />;
}

function AppPreview() {
  const members = [
    { nick: 'luna', avatar: 'pink', speaking: true },
    { nick: 'kaio', avatar: 'blue', muted: true },
    { nick: 'duda', avatar: 'green' },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface-1 shadow-2xl shadow-black/60">
      <div className="flex h-9 items-center gap-1.5 border-b border-line px-4">
        {['bg-danger', 'bg-warn', 'bg-ok'].map((c) => (
          <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
        ))}
      </div>
      <div className="flex h-[340px]">
        <div className="hidden w-52 shrink-0 space-y-1 border-r border-line p-3 sm:block">
          <p className="px-2 pb-1 text-[10px] font-bold tracking-wider text-faint uppercase">Salas públicas</p>
          <div className="flex items-center gap-2 rounded-lg bg-surface-4 px-2 py-1.5 text-sm">
            <span className="bg-gradient-accent h-4 w-4 rounded" />
            <span className="flex-1">noite do jogo</span>
            <Volume2 size={13} className="text-ok" />
          </div>
          {members.map((m, i) => (
            <motion.div
              key={m.nick}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.15 }}
              className="flex items-center gap-2 py-1 pl-7 text-xs text-muted"
            >
              <Avatar nick={m.nick} avatar={m.avatar} size={18} speaking={m.speaking} />
              <span className="flex-1">{m.nick}</span>
              {m.muted && <MicOff size={11} className="text-danger" />}
              {m.speaking && <EqBars />}
            </motion.div>
          ))}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted">
            <span className="h-4 w-4 rounded bg-linear-to-br from-sky-400 to-violet-600" />
            filme de sexta
          </div>
        </div>
        <div className="relative flex flex-1 flex-col gap-3 p-4">
          <div className="relative flex-1 overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-purple-700 to-indigo-900">
            <motion.div
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.35),transparent_40%)]"
              animate={{ x: ['-10%', '10%', '-10%'] }}
              transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
            />
            <span className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase">
              <LiveDot /> ao vivo
            </span>
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-ok backdrop-blur">
              <ShieldCheck size={12} /> Som do PC sem Discord
            </span>
          </div>
          <div className="flex gap-3">
            {members.map((m) => (
              <div key={m.nick} className={`flex h-16 flex-1 items-center justify-center rounded-xl bg-surface-3 ${m.speaking ? 'ring-2 ring-ok' : ''}`}>
                <Avatar nick={m.nick} avatar={m.avatar} size={32} />
              </div>
            ))}
          </div>
          <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-2xl border border-line bg-surface-2/90 p-1.5 backdrop-blur">
            {[Headphones, MonitorUp, PhoneCall].map((Icon, i) => (
              <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-xl ${i === 2 ? 'bg-danger' : i === 1 ? 'bg-gradient-accent' : 'bg-surface-4'}`}>
                <Icon size={15} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamStage() {
  const guests = [
    { nick: 'Rose', avatar: 'pink' },
    { nick: 'z_lot', avatar: 'blue', live: true },
    { nick: 'Olive', avatar: 'green' },
  ];
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/25 p-4 shadow-2xl shadow-black/40">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-fuchsia-500 via-violet-600 to-indigo-800 p-3">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-linear-to-br from-rose-300 via-orange-200 to-violet-400">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_30%,rgba(255,255,255,.45),transparent_45%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/50 to-transparent" />
          <span className="absolute top-3 right-3 rounded-md bg-danger px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
            LIVE
          </span>
          <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            z_lot
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {guests.map((g) => (
            <div key={g.nick} className="relative overflow-hidden rounded-xl bg-white/15 p-3">
              <div className="flex items-center justify-center">
                <Avatar nick={g.nick} avatar={g.avatar} size={44} />
              </div>
              <p className="mt-2 truncate text-center text-[11px] font-semibold text-white">{g.nick}</p>
              {g.live && (
                <span className="absolute top-2 right-2 rounded bg-danger px-1 text-[9px] font-bold text-white">LIVE</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceRoomCard() {
  const channels = [
    { name: 'jogando', kind: 'text' },
    { name: 'chat-principal', kind: 'text' },
    { name: 'voz-geral', kind: 'voice', people: ['Rod', "I'm a Bird", 'moongirl', 'kirbs'] },
  ];
  return (
    <div className="flex overflow-hidden rounded-[2rem] border border-white/10 bg-surface-1 shadow-2xl shadow-black/40">
      <div className="w-44 shrink-0 border-r border-line bg-surface-2 p-3 sm:w-52">
        <p className="mb-3 truncate text-sm font-semibold">A tripulação</p>
        <p className="mb-1 text-[10px] font-bold tracking-wider text-faint uppercase">Canais de texto</p>
        {channels
          .filter((c) => c.kind === 'text')
          .map((c) => (
            <p key={c.name} className="rounded-md px-2 py-1 text-sm text-muted">
              # {c.name}
            </p>
          ))}
        <p className="mt-3 mb-1 text-[10px] font-bold tracking-wider text-faint uppercase">Canais de voz</p>
        <div className="rounded-md bg-white/8 px-2 py-1.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ok">
            <Volume2 size={13} /> voz-geral
          </p>
          {channels[2].people?.map((nick, i) => (
            <div key={nick} className="mt-1.5 flex items-center gap-2 pl-3">
              <Avatar nick={nick} avatar={['red', 'blue', 'pink', 'green'][i]} size={18} />
              <span className="truncate text-xs text-muted">{nick}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 p-3">
        {[
          { nick: 'Rod', avatar: 'red', cam: true },
          { nick: 'moongirl', avatar: 'pink' },
          { nick: "I'm a Bird", avatar: 'blue' },
          { nick: 'kirbs', avatar: 'green' },
        ].map((p) => (
          <div
            key={p.nick}
            className={`relative flex min-h-24 items-end overflow-hidden rounded-xl p-2 ${
              p.cam ? 'bg-linear-to-br from-amber-200 to-rose-400' : 'bg-surface-3'
            }`}
          >
            {!p.cam && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Avatar nick={p.nick} avatar={p.avatar} size={40} />
              </div>
            )}
            <span className="relative rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold">{p.nick}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotifyCard() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#1db954]/25 bg-surface-1 p-5 shadow-2xl shadow-black/40">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-wider text-[#1db954] uppercase">
        <SpotifyLogo size={14} /> Ouvindo no Spotify
      </p>
      <div className="flex gap-4">
        <div className="h-28 w-28 shrink-0 rounded-xl bg-linear-to-br from-[#1db954] to-[#0b5f2a] shadow-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold">Midnight City</p>
          <p className="text-sm text-muted">M83</p>
          <p className="mt-1 text-xs text-faint">Hurry Up, We’re Dreaming</p>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/15">
            <motion.div
              className="h-full rounded-full bg-[#1db954]"
              initial={{ width: '18%' }}
              animate={{ width: ['18%', '72%'] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-faint tabular-nums">
            <span>0:48</span>
            <span>4:03</span>
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-black/30 px-3 py-2 text-xs text-muted">
        Ana. · aparece no perfil, no status e na lista de amigos
      </p>
    </div>
  );
}

function Story({
  id,
  kicker,
  title,
  text,
  reverse,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  text: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className={`grid items-center gap-10 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          {kicker && <p className="mb-3 text-xs font-bold tracking-[0.2em] text-accent-2 uppercase">{kicker}</p>}
          <h2 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-white uppercase md:text-5xl">{title}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/80">{text}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 100, damping: 18 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { scrollYProgress } = useScroll();
  const previewY = useTransform(scrollYProgress, [0, 0.25], [0, -40]);
  const previewRotate = useTransform(scrollYProgress, [0, 0.25], [6, 0]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#4c1d95]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[52rem] bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,.45),transparent_32%),linear-gradient(180deg,#5b21b6_0%,#4c1d95_42%,#0c0d11_100%)]" />
      <div className="grain" />

      <header className="relative z-20 mx-auto flex max-w-6xl items-center gap-4 px-6 py-5">
        <Logo />
        <nav className="no-scrollbar ml-4 hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white sm:inline">
            Entrar
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/20 transition hover:scale-[1.03]"
          >
            Abrir PassTime
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-8 text-center md:pt-16">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="mx-auto max-w-4xl font-display text-5xl leading-[0.95] font-extrabold tracking-tight text-white uppercase md:text-7xl"
        >
          Bate-papo em grupo repleto de diversão e jogos
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85"
        >
          O PassTime é ótimo para jogar e relaxar com os amigos — ou para criar sua comunidade. Salas públicas, chamadas
          privadas e transmissão de tela com o som do PC inteiro. Sem a call do Discord vazando.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          <a
            href="#baixar"
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black shadow-xl shadow-black/20 transition hover:scale-[1.03]"
          >
            <Download size={18} /> Baixar o app
          </a>
          <Link
            to="/login"
            className="bg-gradient-accent inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-black/30 transition hover:brightness-110"
          >
            Abra o PassTime no seu navegador
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, type: 'spring', stiffness: 80, damping: 18 }}
          style={{ y: previewY, rotateX: previewRotate, transformPerspective: 1200 }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <AppPreview />
        </motion.div>
      </section>

      <div className="relative z-10 bg-[#0c0d11]">
        <div className="mx-auto max-w-6xl space-y-28 px-6 py-24">
          <Story
            id="transmitir"
            kicker="Tela e voz"
            title="Transmita como se você estivesse na mesma sala"
            text="Com a transmissão de alta qualidade e baixa latência, parece que você está no sofá com os amigos enquanto alguém joga, assiste a uma série ou mostra a lição de casa. O som do PC vai junto — o Discord, não."
          >
            <StreamStage />
          </Story>

          <Story
            id="voz"
            reverse
            kicker="Sem compromisso"
            title="Entre quando estiver disponível — não precisa ligar"
            text="Entre e saia facilmente dos bate-papos em voz ou texto, sem precisar ligar ou fazer um convite. A sala fica aberta: o grupo pode começar antes e continuar durante e depois da jogatina."
          >
            <VoiceRoomCard />
          </Story>

          <Story
            id="spotify"
            kicker="Atividade"
            title="Mostre o que você está ouvindo"
            text="Conecte o Spotify uma vez. A faixa aparece no perfil, no status e na lista de amigos. Quem quiser ouvir junto entra na sala e o DJ manda o áudio — o PassTime só mostra, nunca controla a conta de ninguém."
          >
            <SpotifyCard />
          </Story>

          <Story
            id="amigos"
            reverse
            kicker="Quem importa"
            title="Ligue direto, mesmo se a pessoa estiver offline"
            text="Adicione pelo nick, aceite o pedido e ligue. Se o amigo estiver fora, o toque espera até ela abrir o PassTime. Mensagens, figurinhas, grupos e chamada de vídeo ficam na mesma conversa."
          >
            <div className="rounded-[2rem] border border-line bg-surface-1 p-5 shadow-2xl">
              <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
                <Avatar nick="luna" avatar="pink" size={48} status="online" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">luna</p>
                  <p className="text-sm text-[#1db954]">Ouvindo Midnight City</p>
                </div>
                <span className="rounded-full bg-ok/20 p-2 text-ok">
                  <PhoneCall size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl p-4">
                <Avatar nick="kaio" avatar="blue" size={48} status="offline" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">kaio</p>
                  <p className="text-sm text-muted">Offline · toca quando entrar</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl p-4">
                <Avatar nick="duda" avatar="green" size={48} status="idle" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">duda</p>
                  <p className="text-sm text-muted">Na sala noite do jogo</p>
                </div>
              </div>
            </div>
          </Story>

          <section id="salas" className="scroll-mt-24">
            <div className="mb-10 max-w-2xl">
              <p className="mb-3 text-xs font-bold tracking-[0.2em] text-accent-2 uppercase">Tudo no mesmo lugar</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight text-white uppercase md:text-5xl">Feito para passar o tempo junto</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 140, damping: 18 }}
                  whileHover={{ y: -6 }}
                  className="rounded-3xl border border-line bg-surface-1/90 p-6"
                >
                  <span className="bg-gradient-accent mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl">{feature.icon}</span>
                  <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="baixar" className="scroll-mt-24 overflow-hidden rounded-[2.5rem] border border-white/10 bg-linear-to-br from-violet-700 via-purple-800 to-indigo-950 p-8 md:p-14">
            <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Sparkles size={16} /> App desktop
                </p>
                <h2 className="font-display text-4xl font-extrabold tracking-tight text-white uppercase">
                  Baixe o PassTime para Windows
                </h2>
                <p className="mt-4 text-lg text-white/80">
                  No navegador você já fala, liga a câmera e entra nas salas. O app captura o som de cada programa e deixa o Discord de fora — o jeito certo de transmitir jogo e música.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black transition hover:scale-[1.03]"
                >
                  <Download size={18} /> Criar conta e começar
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
                >
                  Já tenho conta <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-white">
                  {item.label}
                </a>
              ))}
            </nav>
            <p className="text-sm text-faint">PassTime · feito para transmitir junto</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
