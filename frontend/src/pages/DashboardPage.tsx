import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useI18n } from '../i18n/I18n';
import { Mosaic } from '../components/Mosaic';
import { BigMoney, ErrorBox, Loading, MonthSwitch, useRelativeDays } from '../components/ui';
import { currentMonth, date, money, monthLabel, signedMoney, todayIso } from '../utils/format';

const ALERT_WINDOW_DAYS = 30;

function monthName(month: string, lang: 'de' | 'fr' | 'en'): string {
  const [y, m] = month.split('-').map(Number);
  const locale = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' }[lang];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { timeZone: 'UTC', month: 'long' });
}

function shortMonth(iso: string, lang: 'de' | 'fr' | 'en'): string {
  const [y, m] = iso.split('-').map(Number);
  const locale = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' }[lang];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, { timeZone: 'UTC', month: 'short' }).replace('.', '');
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function DashboardPage() {
  const { t, lang } = useI18n();
  const relative = useRelativeDays();
  const [month, setMonth] = useState(currentMonth());

  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const summary = useQuery({ queryKey: ['monthly'], queryFn: api.monthly });
  const balance = useQuery({ queryKey: ['month', month], queryFn: () => api.month(month) });
  const payments = useQuery({ queryKey: ['payments', month], queryFn: () => api.payments(month) });
  const upcoming = useQuery({ queryKey: ['upcoming', 3], queryFn: () => api.upcoming(3) });
  const payouts = useQuery({ queryKey: ['payouts'], queryFn: api.upcomingPayouts });
  const deadlines = useQuery({ queryKey: ['deadlines'], queryFn: api.deadlines });

  const firstError = [me, summary, balance, upcoming, payouts, deadlines].find((q) => q.error)?.error;
  if (firstError) {
    return <ErrorBox error={firstError} />;
  }
  if (!me.data || !summary.data || !balance.data || !upcoming.data || !payouts.data || !deadlines.data) {
    return <Loading />;
  }

  const currency = me.data.currency;
  const s = summary.data;
  const b = balance.data;
  const today = todayIso();
  const nextDeadline = deadlines.data.find((d) => d.daysUntilDeadline !== null && d.daysUntilDeadline >= 0 && d.daysUntilDeadline <= ALERT_WINDOW_DAYS);
  const nextPayout = payouts.data[0];

  // Gleiche Tage zusammenfassen: "Miete + 2"
  const dayCards: { key: string; date: string; title: string; more: number; amount: number; payout: boolean; expenseId: number }[] = [];
  for (const u of upcoming.data.filter((x) => x.dueDate >= today)) {
    const last = dayCards[dayCards.length - 1];
    if (last && last.date === u.dueDate && !last.payout && u.type === 'EXPENSE') {
      last.amount += u.amountCents;
      last.more += 1;
    } else {
      dayCards.push({ key: `${u.type}-${u.expenseId}-${u.dueDate}`, date: u.dueDate, title: u.name, more: 0, amount: u.amountCents, payout: u.type === 'PAYOUT', expenseId: u.expenseId });
    }
  }

  let hero = (
    <section className="card" aria-label={t('dash.dueThisMonth', { month: monthName(month, lang) })}>
      <span className="card-title">{t('dash.dueThisMonth', { month: monthName(month, lang) })}</span>
      <BigMoney text={money(b.outgoingCents, lang, currency)} />
      <Link to="/settings" className="small muted" style={{ textDecoration: 'underline' }}>{t('dash.setIncome')}</Link>
    </section>
  );
  if (b.availableCents !== null && b.incomeCents !== null) {
    let used = 0;
    if (b.incomeCents > 0) {
      used = Math.min(100, (b.outgoingCents / b.incomeCents) * 100);
    }
    let progress: string | null = null;
    if (payments.data && payments.data.items.length > 0) {
      const paid = payments.data.items.filter((i) => i.status === 'PAID').length;
      progress = t('dash.paidProgress', { paid, total: payments.data.items.filter((i) => i.status !== 'SKIPPED').length });
    }
    hero = (
      <section className="card" aria-label={t('dash.left', { month: monthName(month, lang) })} style={{ justifyContent: 'space-between' }}>
        <span className="card-title">{t('dash.left', { month: monthName(month, lang) })}</span>
        <BigMoney text={money(b.availableCents, lang, currency)} />
        <div className="bar" aria-hidden="true"><div style={{ width: `${used}%` }} /></div>
        <span className="small muted">
          {t('dash.goingOut', { income: money(b.incomeCents, lang, currency), out: money(b.outgoingCents, lang, currency) })}
          {b.incomingCents > 0 && ` · ${signedMoney(b.incomingCents, lang, currency)}`}
        </span>
        {progress && <Link to="/payments" className="small muted">{progress} ›</Link>}
      </section>
    );
  }

  return (
    <>
      <div className="page-title">
        <span className="wordmark" style={{ fontSize: 26 }}>
          <span className="desktop-hide">fixkosten</span>
        </span>
        <MonthSwitch
          label={monthLabel(month, lang).replace(/\s\d{4}$/, '')}
          onPrev={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
          prevLabel={t('pay.prev')}
          nextLabel={t('pay.next')}
        />
      </div>

      {s.activeCount === 0 && (
        <Link to="/expenses/new" className="note note-sage">
          <span className="body"><span className="title">{t('dash.empty')}</span></span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      <div className="grid-desktop">
        <div className="hero-col">{hero}</div>
        <div className="mosaic-col">
          {s.byCategory.length > 0 && (
            <section className="card" aria-labelledby="where" style={{ padding: 0, background: 'transparent', gap: 8 }}>
              <div className="desktop-only" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 id="where" className="card-title">{t('dash.where')}</h2>
                <span className="small muted">{t('dash.avg', { amount: money(s.totalMonthlyCents, lang, currency) })}</span>
              </div>
              <Mosaic items={s.byCategory} total={s.totalMonthlyCents} currency={currency} />
            </section>
          )}
        </div>
      </div>

      {nextDeadline && nextDeadline.daysUntilDeadline !== null && nextDeadline.cancellationDeadline && (
        <Link to={`/expenses/${nextDeadline.expenseId}`} className="note note-peach">
          <span className="body">
            <span className="kicker">{t('dash.reminder', { when: relative(nextDeadline.daysUntilDeadline) })}</span>
            <span className="title">{t('dash.cancelCard', { name: nextDeadline.name, date: date(nextDeadline.cancellationDeadline, lang) })}</span>
          </span>
          <span aria-hidden="true" style={{ fontSize: 20 }}>›</span>
        </Link>
      )}

      {dayCards.length > 0 && (
        <section aria-labelledby="next" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="next" className="card-title">{t('dash.next')}</h2>
          <div className="hscroll">
            {dayCards.slice(0, 10).map((c) => {
              let cls = 'daycard';
              if (c.payout) {
                cls = 'daycard note-sage';
              }
              let amount = money(c.amount, lang, currency);
              if (c.payout) {
                amount = signedMoney(c.amount, lang, currency);
              }
              return (
                <Link key={c.key} to={`/expenses/${c.expenseId}`} className={cls}>
                  <span className="day">{c.date.substring(8, 10)}<small>{shortMonth(c.date, lang)}</small></span>
                  <span className="name"><span>{c.title}</span>{c.more > 0 && <span>+{c.more}</span>}</span>
                  <span className="small muted num">{amount}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {nextPayout && (
        <Link to={`/expenses/${nextPayout.expenseId}`} className="note note-sage">
          <span className="body">
            <span className="kicker">{nextPayout.name} · {date(nextPayout.date, lang)} · {relative(nextPayout.daysUntil)}</span>
            <span className="title">{t('dash.yourTurn', { amount: signedMoney(nextPayout.amountCents, lang, currency) })}</span>
          </span>
          <span aria-hidden="true" style={{ fontSize: 20 }}>›</span>
        </Link>
      )}
    </>
  );
}
