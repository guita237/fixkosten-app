import { CSSProperties, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ContractDeadline, Expense } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading } from '../components/ui';
import { date, money, todayIso } from '../utils/format';

const NO_CATEGORY = -1;

interface Group {
  id: number;
  name: string;
  color: string;
  total: number;
  items: Expense[];
}

function tint(color: string): CSSProperties {
  return { ['--c' as string]: color } as CSSProperties;
}

export function ExpensesPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showEnded, setShowEnded] = useState(false);

  const expenses = useQuery({ queryKey: ['expenses'], queryFn: api.expenses });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const deadlines = useQuery({ queryKey: ['deadlines'], queryFn: api.deadlines });
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const currency = me.data?.currency ?? 'EUR';
  const today = todayIso();

  let categoryFilter: number | null = null;
  const fromUrl = params.get('category');
  if (fromUrl) {
    categoryFilter = Number(fromUrl);
  }
  const setCategory = (id: number | null) => {
    if (id === null) {
      setParams({});
    } else {
      setParams({ category: String(id) });
    }
  };

  const deadlineById = useMemo(() => {
    const map = new Map<number, ContractDeadline>();
    for (const d of deadlines.data ?? []) {
      map.set(d.expenseId, d);
    }
    return map;
  }, [deadlines.data]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<number, Group>();
    for (const e of expenses.data ?? []) {
      const running = e.active && !e.ended;
      if (!running && !showEnded) {
        continue;
      }
      if (term && !e.name.toLowerCase().includes(term) && !(e.provider ?? '').toLowerCase().includes(term)) {
        continue;
      }
      const id = e.category?.id ?? NO_CATEGORY;
      if (categoryFilter !== null && id !== categoryFilter) {
        continue;
      }
      let group = map.get(id);
      if (!group) {
        group = { id, name: e.category?.name ?? t('common.noCategory'), color: e.category?.color ?? '#8A9096', total: 0, items: [] };
        map.set(id, group);
      }
      group.items.push(e);
      if (running) {
        group.total += e.monthlyCostCents;
      }
    }
    const list = [...map.values()];
    for (const g of list) {
      g.items.sort((a, b) => b.monthlyCostCents - a.monthlyCostCents);
    }
    return list.sort((a, b) => b.total - a.total);
  }, [expenses.data, search, showEnded, categoryFilter, t]);

  if (expenses.error) {
    return <ErrorBox error={expenses.error} />;
  }
  if (!expenses.data) {
    return <Loading />;
  }

  const total = expenses.data.filter((e) => e.active && !e.ended).reduce((s, e) => s + e.monthlyCostCents, 0);

  const subLine = (e: Expense) => {
    const parts = [t('list.dueDay', { freq: t(`freq.${e.frequency}`), day: Number(e.firstDueDate.substring(8, 10)) })];
    if (e.frequency !== 'MONTHLY') {
      parts.push(money(e.currentAmountCents, lang, currency));
    }
    if (e.effectiveEndDate) {
      parts.push(t('list.until', { date: date(e.effectiveEndDate, lang) }));
    }
    return parts.join(' · ');
  };

  const hints = (e: Expense) => {
    const result: { text: string; tone: 'peach' | 'sage' }[] = [];
    const change = e.priceChanges.find((c) => c.validFrom > today);
    if (change) {
      result.push({ text: t('list.from', { date: date(change.validFrom, lang), amount: money(change.amountCents, lang, currency) }), tone: 'peach' });
    }
    const payout = e.payouts.filter((p) => !p.received && p.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (payout) {
      result.push({ text: t('list.payoutOn', { amount: '+' + money(payout.amountCents, lang, currency), date: date(payout.date, lang) }), tone: 'sage' });
    }
    const d = deadlineById.get(e.id);
    if (d && d.cancellationDeadline && d.daysUntilDeadline !== null && d.daysUntilDeadline >= 0 && d.daysUntilDeadline <= 60) {
      result.push({ text: t('list.cancelBy', { date: date(d.cancellationDeadline, lang) }), tone: 'peach' });
    }
    if (e.contract?.cancelled) {
      result.push({ text: t('list.cancelled'), tone: 'sage' });
    }
    return result;
  };

  return (
    <>
      <div className="page-title">
        <h1>{t('list.title')}</h1>
        <span className="small muted num">{t('list.perMonthShort', { amount: money(total, lang, currency) })}</span>
      </div>

      <label className="search">
        <Icon name="search" />
        <span className="sr-only">{t('list.search')}</span>
        <input type="search" placeholder={t('list.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <div className="chips" role="group" aria-label={t('list.category')}>
        <button type="button" className="chip chip-dark" aria-pressed={categoryFilter === null} onClick={() => setCategory(null)}>{t('list.all', { n: expenses.data.filter((e) => e.active && !e.ended).length })}</button>
        {(categories.data ?? []).map((c) => (
          <button key={c.id} type="button" className="chip tint" style={tint(c.color)} aria-pressed={categoryFilter === c.id} onClick={() => setCategory(c.id)}>{c.name}</button>
        ))}
        <button type="button" className="chip chip-dark" aria-pressed={showEnded} onClick={() => setShowEnded(!showEnded)}>{t('list.ended')}</button>
      </div>

      {groups.length === 0 && <div className="card"><span className="muted">{t('list.empty')}</span></div>}

      {groups.map((g) => (
        <section key={g.id} className="card-flat" aria-label={g.name}>
          <div className="group-head tint" style={tint(g.color)}>
            <strong>{g.name}</strong>
            <span className="value num">{money(g.total, lang, currency)}</span>
          </div>
          <div className="rows">
            {g.items.map((e) => {
              let cls = 'row row-link';
              if (!e.active || e.ended) {
                cls = 'row row-link ended';
              }
              return (
                <div key={e.id} className={cls} role="link" tabIndex={0} onClick={() => navigate(`/expenses/${e.id}`)} onKeyDown={(ev) => { if (ev.key === 'Enter') { navigate(`/expenses/${e.id}`); } }}>
                  <span className="main">
                    <strong>{e.name}</strong>
                    <span className="sub">{subLine(e)}</span>
                    {hints(e).map((h) => (
                      <span key={h.text} className={`hint-${h.tone}`}>{h.text}</span>
                    ))}
                  </span>
                  <span className="num">{money(e.monthlyCostCents, lang, currency)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
