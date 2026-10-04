import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import AuthLayout from '../components/AuthLayout';
import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.login, form.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/app', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Que bom te ver!" subtitle="Entre para falar com seus amigos.">
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
        <div>
          <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted uppercase">Nick ou email</label>
          <input className="input" autoComplete="username" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted uppercase">Senha</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <Button type="submit" disabled={busy} size="lg" className="mt-2 w-full">
          {busy ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Precisa de uma conta?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-accent hover:underline">
          Cadastre-se
        </Link>
        . Se o email já estiver cadastrado, entre com o nick em vez de criar de novo.
      </p>
    </AuthLayout>
  );
}
