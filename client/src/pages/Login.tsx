import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import AuthLayout, { AuthError, AuthInput, AuthLabel, AuthSubmit } from '../components/AuthLayout';
import AuthQr from '../components/AuthQr';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);

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
    <AuthLayout wide>
      <div className="flex items-stretch gap-10">
        <form onSubmit={(e) => void submit(e)} className="min-w-0 flex-1">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl font-bold"
          >
            De volta ao PassTime
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="mt-1.5 mb-7 text-muted">
            Entra pra ligar, mandar mensagem e ficar com a galera.
          </motion.p>
          <div className="space-y-4">
            <AuthError error={error} />
            <div>
              <AuthLabel required>E-mail</AuthLabel>
              <AuthInput
                type="email"
                autoComplete="email"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <AuthLabel required>Senha</AuthLabel>
              <AuthInput
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="mt-2 block text-left text-sm font-semibold text-accent hover:underline"
                aria-expanded={hint}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHint((v) => !v);
                }}
              >
                Esqueceu a senha?
              </button>
              {hint && (
                <p className="mt-2 rounded-xl bg-surface-3 px-3 py-2 text-xs leading-relaxed text-muted">
                  Por enquanto o PassTime não reabre a conta sozinho. Use o e-mail com que você se cadastrou. Se travar de vez,
                  fale com quem administra este servidor.
                </p>
              )}
            </div>
            <AuthSubmit busy={busy} idle="Entrar" busyLabel="Entrando..." />
          </div>
          <p className="mt-6 text-sm text-muted">
            Ainda sem conta?{' '}
            <Link to="/register" state={location.state} className="font-semibold text-accent hover:underline">
              Criar uma agora
            </Link>
          </p>
        </form>
        <div className="hidden w-px bg-line md:block" />
        <AuthQr />
      </div>
    </AuthLayout>
  );
}
