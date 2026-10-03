import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import AuthLayout from '../components/AuthLayout';
import Avatar from '../components/Avatar';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { AVATARS } from '../lib/theme';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    nick: '',
    email: params.get('email') ?? '',
    password: '',
    confirm: '',
    avatar: 'red',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('As senhas não conferem');
      return;
    }
    setBusy(true);
    try {
      await register(form.nick, form.email, form.password, form.avatar);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/app', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const label = 'mb-1.5 block text-xs font-bold tracking-wider text-muted uppercase';

  return (
    <AuthLayout title="Criar conta" subtitle="Escolha um nick: é assim que seus amigos vão te achar.">
      <form onSubmit={submit} className="space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', x: [0, -8, 8, -4, 0] }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <motion.div key={form.avatar} initial={{ scale: 0.7, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            <Avatar nick={form.nick || '?'} avatar={form.avatar} size={64} />
          </motion.div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(AVATARS).map((key) => (
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                key={key}
                onClick={() => setForm({ ...form, avatar: key })}
                className={`rounded-full transition ${form.avatar === key ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-1' : 'opacity-60 hover:opacity-100'}`}
                title={AVATARS[key].label}
              >
                <Avatar nick="" avatar={key} size={26} />
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Nick</label>
          <input
            className="input"
            autoComplete="nickname"
            value={form.nick}
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_.\-]+"
            title="Letras, números, ponto, hífen e underline"
            onChange={(e) => setForm({ ...form, nick: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div>
          <label className={label}>Email</label>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Senha</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              placeholder="mín. 6"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label className={label}>Confirmar</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={busy} size="lg" className="mt-2 w-full">
          {busy ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Já tem conta?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
