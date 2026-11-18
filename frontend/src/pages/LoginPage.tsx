import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/Auth';
import { useI18n } from '../i18n/I18n';

export function LoginPage() {
  const { t } = useI18n();
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    try {
      await resetPassword(email);
      setInfo(t('login.resetSent'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  let title = t('login.title');
  let submitLabel = t('login.submit');
  let switchLabel = t('login.toRegister');
  let nextMode: 'login' | 'register' = 'register';
  if (mode === 'register') {
    title = t('login.register');
    submitLabel = t('login.submitRegister');
    switchLabel = t('login.toLogin');
    nextMode = 'login';
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit} style={{ gap: 14 }}>
        <span className="wordmark">fixkosten</span>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 400 }}>{title}</h1>
        <label className="field">
          <span>{t('login.email')}</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('login.password')}</span>
          <input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error-box" role="alert">{error}</div>}
        {info && <div className="note note-sage"><span className="body">{info}</span></div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{submitLabel}</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setMode(nextMode)}>{switchLabel}</button>
          {mode === 'login' && <button type="button" className="btn btn-ghost btn-small" onClick={forgot} disabled={!email}>{t('login.forgot')}</button>}
        </div>
      </form>
    </div>
  );
}
