import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthError, AuthInput, AuthLabel, AuthLink, AuthSubmit } from '../components/AuthLayout';
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
      <div className="flex gap-12">
        <form onSubmit={(e) => void submit(e)} className="min-w-0 flex-1">
          <h1 className="text-center text-2xl font-semibold text-white">De volta ao PassTime</h1>
          <p className="mt-1.5 mb-5 text-center text-[15px] text-[#b5bac1]">Que bom que você voltou pra conversar com a galera.</p>
          <div className="space-y-4">
            <AuthError error={error} />
            <div>
              <AuthLabel required>E-mail ou nick</AuthLabel>
              <AuthInput
                autoComplete="username"
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
              <AuthLink className="mt-1.5" onClick={() => setHint((v) => !v)}>
                Esqueceu a senha?
              </AuthLink>
              {hint && (
                <p className="mt-2 text-xs leading-relaxed text-[#b5bac1]">
                  Por enquanto o PassTime não reabre a conta sozinho. Tente o nick se o e-mail não funcionar. Se travar de vez,
                  fale com quem administra este servidor.
                </p>
              )}
            </div>
            <AuthSubmit busy={busy} idle="Entrar" busyLabel="Entrando..." />
          </div>
          <p className="mt-3 text-sm text-[#949ba4]">
            Ainda sem conta?{' '}
            <Link to="/register" state={location.state} className="auth-link">
              Criar uma agora
            </Link>
          </p>
        </form>
        <AuthQr />
      </div>
    </AuthLayout>
  );
}
