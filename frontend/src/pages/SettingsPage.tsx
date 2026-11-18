import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Category, Language, Me } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { useAuth } from '../auth/Auth';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, Switch, useToast } from '../components/ui';
import { centsToInput, money, parseMoneyInput, percent } from '../utils/format';
import { getTheme, setTheme, Theme } from '../theme';
import { CSSProperties } from 'react';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

// Mitteltöne – werden in der Oberfläche zu Pastell gemischt
const PALETTE = ['#6F93AD', '#7E9A78', '#C98F6B', '#9686B8', '#B39B6A', '#8A9096', '#B5838D', '#6FA3A0'];

function CategoryRow({ category, onSaved }: { category: Category; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const update = useMutation({ mutationFn: () => api.updateCategory(category.id, { name, color }), onSuccess: onSaved });
  const remove = useMutation({ mutationFn: () => api.deleteCategory(category.id), onSuccess: onSaved });
  const changed = name !== category.name || color !== category.color;

  return (
    <div className="row" style={{ gap: 10 }}>
      <label className="swatch" style={{ ['--c' as string]: color, position: 'relative', overflow: 'hidden' } as CSSProperties}>
        <input type="color" aria-label={t('set.categoryColor')} value={color} onChange={(e) => setColor(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
      <input aria-label={t('set.categoryName')} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontSize: 15 }} />
      {changed && <button type="button" className="btn btn-small btn-primary" disabled={update.isPending} onClick={() => update.mutate()}>{t('common.save')}</button>}
      <button
        type="button"
        className="icon-btn"
        aria-label={`${category.name} ${t('common.delete')}`}
        onClick={() => {
          if (window.confirm(t('common.confirmDelete', { name: category.name }))) {
            remove.mutate();
          }
        }}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user, devMode, logout } = useAuth();
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();

  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const summary = useQuery({ queryKey: ['monthly'], queryFn: api.monthly });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  const [income, setIncome] = useState('');
  const [incomeError, setIncomeError] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderDays, setReminderDays] = useState('7');
  // color null = automatisch die nächste Palettenfarbe vorschlagen
  const [newCat, setNewCat] = useState<{ name: string; color: string | null }>({ name: '', color: null });
  const [testInfo, setTestInfo] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const newCatColor = newCat.color ?? PALETTE[(categories.data?.length ?? 0) % PALETTE.length];

  useEffect(() => {
    if (me.data) {
      setIncome(centsToInput(me.data.monthlyNetIncomeCents, lang));
      setReminderEmail(me.data.reminderEmail ?? '');
      setReminderDays(String(me.data.reminderDaysBefore));
    }
  }, [me.data, lang]);

  const refreshAll = () => queryClient.invalidateQueries();

  const updateMe = useMutation({
    mutationFn: (patch: Partial<Me>) => api.updateMe(patch),
    onSuccess: async () => {
      await refreshAll();
      showToast(t('common.saved'));
    },
  });

  const addCategory = useMutation({
    mutationFn: () => api.createCategory({ name: newCat.name.trim(), color: newCatColor }),
    onSuccess: async () => {
      setNewCat({ name: '', color: null });
      await refreshAll();
    },
  });

  const testMail = useMutation({
    mutationFn: api.testMail,
    onSuccess: (res) => {
      if (res.mailerConfigured) {
        setTestInfo(t('set.testMailSent', { to: res.to }));
      } else {
        setTestInfo(t('set.testMailLogOnly'));
      }
    },
  });

  if (me.error) {
    return <ErrorBox error={me.error} />;
  }
  if (!me.data) {
    return <Loading />;
  }
  const m = me.data;

  const saveIncome = (e: FormEvent) => {
    e.preventDefault();
    if (income.trim() === '') {
      setIncomeError(false);
      updateMe.mutate({ monthlyNetIncomeCents: null });
      return;
    }
    const cents = parseMoneyInput(income);
    if (cents === null || cents < 0) {
      setIncomeError(true);
      return;
    }
    setIncomeError(false);
    updateMe.mutate({ monthlyNetIncomeCents: cents });
  };

  const saveReminders = (e: FormEvent) => {
    e.preventDefault();
    let days = Number(reminderDays);
    if (!Number.isInteger(days) || days < 1) {
      days = 7;
    }
    updateMe.mutate({ reminderEmail: reminderEmail.trim() || null, reminderDaysBefore: Math.min(days, 60) });
  };

  const chooseLanguage = (code: Language) => {
    setLang(code);
    updateMe.mutate({ language: code });
  };

  const total = summary.data?.totalMonthlyCents ?? 0;

  const chooseTheme = (next: Theme) => {
    setThemeState(next);
    setTheme(next);
  };
  const themes: Theme[] = ['light', 'dark', 'system'];

  return (
    <>
      <div className="page-title"><h1>{t('set.title')}</h1></div>
      {updateMe.error && <ErrorBox error={updateMe.error} />}

      <h2 className="section-label">{t('set.group.money')}</h2>
      <form className="card" onSubmit={saveIncome} style={{ gap: 10 }}>
        <label className="field">
          <span>{t('set.incomeLabel')}</span>
          <input inputMode="decimal" placeholder="0,00" value={income} onChange={(e) => setIncome(e.target.value)} aria-invalid={incomeError} />
        </label>
        {incomeError && <span className="field-error">{t('form.invalidAmount')}</span>}
        <span className="small muted" style={{ padding: '0 6px' }}>{t('set.incomeHint')}</span>
        {m.monthlyNetIncomeCents !== null && m.monthlyNetIncomeCents > 0 && (
          <>
            <div className="bar" aria-hidden="true"><div style={{ width: `${Math.min(100, (total / m.monthlyNetIncomeCents) * 100)}%` }} /></div>
            <span className="small muted">{t('set.incomeShare', { percent: percent(total, m.monthlyNetIncomeCents, lang) })} · {t('dash.available')}: {money(m.monthlyNetIncomeCents - total, lang, m.currency)}</span>
          </>
        )}
        <button type="submit" className="btn btn-primary" disabled={updateMe.isPending}>{t('common.save')}</button>
      </form>

      <h2 className="section-label">{t('set.reminders')}</h2>
      <form className="card-flat rows" onSubmit={saveReminders}>
        <div className="row">
          <span className="main"><strong>{t('set.remindersEnabled')}</strong><span className="sub">{t('set.remindersHint')}</span></span>
          <Switch checked={m.remindersEnabled} label={t('set.remindersEnabled')} onChange={(v) => updateMe.mutate({ remindersEnabled: v })} />
        </div>
        {m.remindersEnabled && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="field"><span>{t('set.reminderEmail')}</span><input type="email" placeholder={m.email} value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} /></label>
            <label className="field"><span>{t('set.reminderDays')}</span><input type="number" min={1} max={60} value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={m.reminderOverdue} onChange={(e) => updateMe.mutate({ reminderOverdue: e.target.checked })} />{t('set.reminderOverdue')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={updateMe.isPending}>{t('common.save')}</button>
              <button type="button" className="btn" disabled={testMail.isPending} onClick={() => testMail.mutate()}>{t('set.testMail')}</button>
            </div>
            {testInfo && <span className="small muted">{testInfo}</span>}
            {testMail.error && <ErrorBox error={testMail.error} />}
          </div>
        )}
      </form>

      <h2 className="section-label">{t('set.display')}</h2>
      <section className="card" style={{ gap: 10 }}>
        <div className="segmented" role="radiogroup" aria-label={t('set.language')}>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} onClick={() => chooseLanguage(l.code)}>{l.label}</button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('set.theme')}>
          {themes.map((th) => (
            <button key={th} type="button" role="radio" aria-checked={theme === th} onClick={() => chooseTheme(th)}>{t(`theme.${th}`)}</button>
          ))}
        </div>
      </section>

      <h2 className="section-label">{t('set.categories')}</h2>
      <section className="card-flat rows">
        {(categories.data ?? []).map((c) => (
          <div key={`${c.id}-${c.name}-${c.color}`} style={{ padding: '6px 16px' }}>
            <CategoryRow category={c} onSaved={refreshAll} />
          </div>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (newCat.name.trim() !== '') {
              addCategory.mutate();
            }
          }}
        >
          <label className="swatch" style={{ ['--c' as string]: newCatColor, position: 'relative', overflow: 'hidden' } as CSSProperties}>
            <input type="color" aria-label={t('set.categoryColor')} value={newCatColor} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </label>
          <input placeholder={t('set.categoryName')} aria-label={t('set.categoryName')} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontSize: 15 }} />
          <button type="submit" className="btn btn-small" disabled={newCat.name.trim() === '' || addCategory.isPending}>{t('set.categoryAdd')}</button>
        </form>
      </section>
      {addCategory.error && <ErrorBox error={addCategory.error} />}

      <h2 className="section-label">{t('set.account')}</h2>
      <section className="card-flat rows">
        <div className="row">
          <span className="main"><span className="sub">{t('set.loggedInAs')}</span><strong>{user?.email}</strong>{devMode && <span className="hint-peach">{t('set.devMode')}</span>}</span>
          {!devMode && <button type="button" className="btn btn-small" onClick={() => logout()}>{t('login.logout')}</button>}
        </div>
      </section>
      {toast}
    </>
  );
}
