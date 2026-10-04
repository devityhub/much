import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import AuthLayout, { AuthError, AuthInput, AuthLabel, AuthLink, AuthSelect, AuthSubmit } from '../components/AuthLayout';
import { useAuth } from '../lib/auth';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const now = new Date();
const YEARS = Array.from({ length: now.getFullYear() - 1919 }, (_, i) => now.getFullYear() - i);

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function yearsOld(year: number, month: number, day: number) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age -= 1;
  return age;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    email: params.get('email') ?? '',
    displayName: '',
    nick: '',
    password: '',
    day: '',
    month: '',
    year: '',
    news: true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<'termos' | 'privacidade' | null>(null);

  const dayCount = useMemo(() => {
    const month = Number(form.month) || 12;
    const year = Number(form.year) || 2000;
    return daysInMonth(year, month);
  }, [form.month, form.year]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const day = Number(form.day);
    const month = Number(form.month);
    const year = Number(form.year);
    if (!day || !month || !year) {
      setError('Informe sua data de nascimento');
      return;
    }
    if (day > daysInMonth(year, month)) {
      setError('Essa data de nascimento não existe');
      return;
    }
    if (yearsOld(year, month, day) < 13) {
      setError('Você precisa ter pelo menos 13 anos para criar uma conta no PassTime');
      return;
    }
    setBusy(true);
    try {
      await register(form.nick, form.email, form.password, undefined, form.displayName.trim() || undefined, {
        day,
        month,
        year,
      });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/app', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-3xl font-bold">
          Criar conta
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="mt-1.5 mb-2 text-muted">
          Escolhe um nick: é assim que seus amigos vão te achar.
        </motion.p>
        <AuthError error={error} />
        <div>
          <AuthLabel required>E-mail</AuthLabel>
          <AuthInput
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div>
          <AuthLabel>Nome exibido</AuthLabel>
          <AuthInput
            autoComplete="nickname"
            maxLength={32}
            placeholder="como aparece nas conversas"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <AuthLabel required>Nome de usuário</AuthLabel>
          <AuthInput
            autoComplete="username"
            value={form.nick}
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_.\-]+"
            title="Letras, números, ponto, hífen e underline"
            onChange={(e) => setForm({ ...form, nick: e.target.value })}
            required
          />
        </div>
        <div>
          <AuthLabel required>Senha</AuthLabel>
          <AuthInput
            type="password"
            autoComplete="new-password"
            minLength={6}
            placeholder="mín. 6 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <div>
          <AuthLabel required>Data de nascimento</AuthLabel>
          <div className="grid grid-cols-3 gap-3">
            <AuthSelect value={form.day} aria-label="Dia" onChange={(e) => setForm({ ...form, day: e.target.value })} required>
              <option value="" disabled>
                Dia
              </option>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </AuthSelect>
            <AuthSelect value={form.month} aria-label="Mês" onChange={(e) => setForm({ ...form, month: e.target.value })} required>
              <option value="" disabled>
                Mês
              </option>
              {MESES.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </AuthSelect>
            <AuthSelect value={form.year} aria-label="Ano" onChange={(e) => setForm({ ...form, year: e.target.value })} required>
              <option value="" disabled>
                Ano
              </option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </AuthSelect>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm leading-snug text-muted">
          <input
            type="checkbox"
            checked={form.news}
            onChange={(e) => setForm({ ...form, news: e.target.checked })}
            className="auth-check mt-0.5"
          />
          <span>
            (Opcional) Quero receber novidades do PassTime, dicas de salas e convites da galera. Posso desligar isso quando
            quiser.
          </span>
        </label>
        <p className="text-xs leading-relaxed text-faint">
          Ao criar a conta, você concorda com os{' '}
          <AuthLink className="text-xs" onClick={() => setLegal(legal === 'termos' ? null : 'termos')}>
            combinados do PassTime
          </AuthLink>{' '}
          e confirma que leu o{' '}
          <AuthLink className="text-xs" onClick={() => setLegal(legal === 'privacidade' ? null : 'privacidade')}>
            aviso de privacidade
          </AuthLink>
          .
        </p>
        {legal === 'termos' && (
          <p className="rounded-xl bg-surface-3 px-3 py-2 text-xs leading-relaxed text-muted">
            Use o PassTime com respeito: sem spam, sem assédio e sem se passar por outra pessoa. Salas e chamadas existem
            para conversar de verdade com a galera.
          </p>
        )}
        {legal === 'privacidade' && (
          <p className="rounded-xl bg-surface-3 px-3 py-2 text-xs leading-relaxed text-muted">
            Guardamos nick, e-mail, senha criptografada e o que você escreve nas conversas desta instância. A data de
            nascimento só serve para checar a idade e não fica salva.
          </p>
        )}
        <AuthSubmit busy={busy} idle="Criar conta" busyLabel="Criando conta..." />
        <p className="text-sm text-muted">
          Já tem conta?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
