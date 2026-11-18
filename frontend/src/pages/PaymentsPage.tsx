import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TrackedDue } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, MonthSwitch } from '../components/ui';
import { currentMonth, date, money, monthLabel, shiftMonth, signedMoney, todayIso } from '../utils/format';

export function PaymentsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());

  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const data = useQuery({ queryKey: ['payments', month], queryFn: () => api.payments(month) });
  const overdue = useQuery({ queryKey: ['overdue'], queryFn: api.overdue });
  const currency = me.data?.currency ?? 'EUR';

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['overdue'] });
  };

  const record = useMutation({
    mutationFn: (args: { due: TrackedDue; status: 'PAID' | 'SKIPPED' }) => {
      let paidDate: string | null = null;
      if (args.status === 'PAID') {
        paidDate = todayIso();
        if (args.due.dueDate > paidDate) {
          paidDate = args.due.dueDate;
        }
      }
      return api.recordPayment(args.due.expenseId, args.due.dueDate, { status: args.status, paidDate });
    },
    onSuccess: refresh,
  });
  const clear = useMutation({ mutationFn: (due: TrackedDue) => api.clearPayment(due.expenseId, due.dueDate), onSuccess: refresh });
  const busy = record.isPending || clear.isPending;

  const toggle = (d: TrackedDue) => {
    if (d.status === 'PAID' || d.status === 'SKIPPED') {
      clear.mutate(d);
    } else {
      record.mutate({ due: d, status: 'PAID' });
    }
  };

  const subLine = (d: TrackedDue) => {
    const parts: string[] = [];
    if (d.status === 'PAID') {
      parts.push(t('pay.paidOn', { date: date(d.paidDate ?? d.dueDate, lang) }));
    } else {
      parts.push(date(d.dueDate, lang));
    }
    if (d.status === 'SKIPPED') {
      parts.push(t('pay.status.SKIPPED'));
    }
    if (d.differenceCents) {
      parts.push(t('pay.difference', { amount: signedMoney(d.differenceCents, lang, currency) }));
    }
    if (d.source === 'CSV') {
      parts.push(t('pay.fromCsv'));
    }
    return parts.join(' · ');
  };

  const row = (d: TrackedDue) => {
    let tickClass = 'tick';
    if (d.status === 'SKIPPED') {
      tickClass = 'tick skipped';
    }
    let subClass = 'sub';
    if (d.status === 'OVERDUE') {
      subClass = 'hint-peach';
    }
    return (
      <div className="row" key={`${d.expenseId}-${d.dueDate}`}>
        <button
          type="button"
          role="checkbox"
          className={tickClass}
          aria-checked={d.status === 'PAID'}
          aria-label={`${d.name} ${t('pay.markPaid')}`}
          disabled={busy}
          onClick={() => toggle(d)}
        >
          {d.status === 'PAID' && <Icon name="ok" size={16} strokeWidth={3} />}
        </button>
        <span className="main">
          <strong>{d.name}</strong>
          <span className={subClass}>{subLine(d)}</span>
        </span>
        {(d.status === 'OPEN' || d.status === 'OVERDUE') && (
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={() => record.mutate({ due: d, status: 'SKIPPED' })}>{t('pay.skip')}</button>
        )}
        <span className="num">{money(d.paidCents ?? d.expectedCents, lang, currency)}</span>
      </div>
    );
  };

  if (data.error) {
    return <ErrorBox error={data.error} />;
  }

  const overdueOther = (overdue.data ?? []).filter((d) => !d.dueDate.startsWith(month));
  const items = data.data?.items ?? [];
  const counted = items.filter((i) => i.status !== 'SKIPPED');
  const paidCount = counted.filter((i) => i.status === 'PAID').length;
  let progress = 0;
  if (data.data && data.data.summary.expectedCents > 0) {
    progress = Math.min(100, (data.data.summary.paidCents / data.data.summary.expectedCents) * 100);
  }

  return (
    <>
      <div className="page-title">
        <h1>{t('pay.title')}</h1>
        <MonthSwitch
          label={monthLabel(month, lang).replace(/\s\d{4}$/, '')}
          onPrev={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
          prevLabel={t('pay.prev')}
          nextLabel={t('pay.next')}
        />
      </div>

      {(record.error || clear.error) && <ErrorBox error={record.error ?? clear.error} />}
      {!data.data && <Loading />}

      {data.data && (
        <>
          <section className="card" aria-label={t('pay.title')}>
            <span><span className="serif" style={{ fontSize: 30 }}>{paidCount}</span> <span className="muted" style={{ fontSize: 17 }}>{t('pay.progress', { total: counted.length })}</span></span>
            <div className="bar" aria-hidden="true"><div style={{ width: `${progress}%` }} /></div>
            <span className="small muted num">{t('pay.progressSum', { paid: money(data.data.summary.paidCents, lang, currency), total: money(data.data.summary.expectedCents, lang, currency) })}</span>
          </section>
          {items.length > 0 && <span className="small muted" style={{ padding: '0 4px' }}>{t('pay.tapHint')}</span>}
          {items.length === 0 && <div className="card"><span className="muted">{t('pay.empty')}</span></div>}
          {items.length > 0 && <div className="card-flat rows">{items.map(row)}</div>}
        </>
      )}

      {overdueOther.length > 0 && (
        <>
          <h2 className="section-label">{t('pay.overdueSection')}</h2>
          <div className="card-flat rows">{overdueOther.map(row)}</div>
        </>
      )}
    </>
  );
}
