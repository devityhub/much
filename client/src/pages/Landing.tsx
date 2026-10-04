import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Headphones, MicOff, MonitorUp, PhoneCall, ShieldCheck, SlidersHorizontal, Users, Volume2 } from 'lucide-react';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';

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
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> ao vivo
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

export default function Landing() {
  const { scrollYProgress } = useScroll();
  const previewY = useTransform(scrollYProgress, [0, 0.4], [0, -60]);
  const previewRotate = useTransform(scrollYProgress, [0, 0.4], [8, 0]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div className="blob -top-64 -left-64 h-[48rem] w-[48rem] bg-accent" />
      <div className="blob top-20 -right-64 h-[42rem] w-[42rem] bg-accent-2" style={{ animationDelay: '-5s' }} />
      <div className="blob top-[56rem] left-1/4 h-[32rem] w-[32rem] bg-indigo-600" style={{ animationDelay: '-10s', opacity: 0.25 }} />
      <div className="grain" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-muted transition hover:text-white">
            Entrar
          </Link>
          <Link to="/register" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-105">
            Criar conta
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-12 text-center md:pt-20">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2/70 px-3 py-1 text-xs font-semibold text-muted backdrop-blur"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> Voz, câmera e tela com seus amigos
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 120, damping: 18 }}
          className="mx-auto mt-6 max-w-4xl font-display text-5xl leading-[1.05] font-extrabold tracking-tight md:text-7xl"
        >
          Transmita o som do PC inteiro. <span className="text-gradient">Menos o Discord.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted"
        >
          PassTime é o lugar para assistir, jogar e conversar junto: salas públicas, chamadas privadas com amigos e transmissão de tela
          com o áudio de tudo — sem a sua call vazando.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mt-9 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/register"
            className="bg-gradient-accent group inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold shadow-xl shadow-accent/30 transition hover:brightness-110"
          >
            Começar agora <ArrowRight size={18} className="transition group-hover:translate-x-1" />
          </Link>
          <Link to="/login" className="inline-flex items-center rounded-2xl border border-line bg-surface-2/70 px-7 py-3.5 font-semibold backdrop-blur transition hover:bg-surface-3">
            Já tenho conta
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 80, damping: 18 }}
          style={{ y: previewY, rotateX: previewRotate, transformPerspective: 1200 }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <AppPreview />
        </motion.div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
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

      <footer className="relative z-10 border-t border-line py-8 text-center text-sm text-faint">PassTime · feito para transmitir junto</footer>
    </div>
  );
}
