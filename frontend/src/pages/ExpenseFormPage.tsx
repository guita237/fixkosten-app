import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Contract, Expense, ExpenseInput, Frequency, NoticeUnit } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { MessageKey } from '../i18n/messages';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, Switch, useRelativeDays, useToast } from '../components/ui';
import { centsToInput, date, money, parseMoneyInput, todayIso } from '../utils/format';
import { CSSProperties } from 'react';
import { monthlyCost, nextDueDates } from '../utils/schedule';
import { DateField } from '../components/DateField';

const FREQUENCIES: Frequency[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'];
const UNITS: NoticeUnit[] = ['DAYS', 'WEEKS', 'MONTHS'];
const RENEWALS = [0, 1, 12, 24];
const PAYMENT_METHODS = ['Lastschrift', 'Dauerauftrag', 'Überweisung', 'Kreditkarte', 'PayPal', 'Bar'];
const NEW_CATEGORY = '__new';

interface PayoutRow {
  date: string;
  amount: string;
  received: boolean;
}

interface FormState {
  name: string;
  provider: string;
  categoryId: string;
  paymentMethod: string;
  amount: string;
  frequency: Frequency;
  firstDueDate: string;
  endDate: string;
  active: boolean;
  note: string;
  hasContract: boolean;
  contract: Contract;
  hasPayouts: boolean;
  payouts: PayoutRow[];
}

function emptyContract(start: string): Contract {
  return { startDate: start, endDate: null, noticeValue: 1, noticeUnit: 'MONTHS', autoRenewMonths: 12, cancelled: false, cancelledOn: null, consumerContract: false };
}

function fromExpense(e: Expense, lang: 'de' | 'fr' | 'en'): FormState {
  let contract = emptyContract(e.firstDueDate);
  if (e.contract) {
    contract = e.contract;
  }
  return {
    name: e.name,
    provider: e.provider ?? '',
    categoryId: categoryIdOf(e),
    paymentMethod: e.paymentMethod ?? '',
    amount: centsToInput(e.amountCents, lang),
    frequency: e.frequency,
    firstDueDate: e.firstDueDate,
    endDate: e.endDate ?? '',
    active: e.active,
    note: e.note ?? '',
    hasContract: e.contract !== null,
    contract,
    hasPayouts: e.payouts.length > 0,
    payouts: e.payouts.map((p) => ({ date: p.date, amount: centsToInput(p.amountCents, lang), received: p.received })),
  };
}

function initialState(): FormState {
  const today = todayIso();
  return {
    name: '',
    provider: '',
    categoryId: '',
    paymentMethod: '',
    amount: '',
    frequency: 'MONTHLY',
    firstDueDate: today,
    endDate: '',
    active: true,
    note: '',
    hasContract: false,
    contract: emptyContract(today),
    hasPayouts: false,
    payouts: [],
  };
}

function categoryIdOf(e: Expense): string {
  if (e.category) {
    return String(e.category.id);
  }
  return '';
}

function toNumberOrNull(v: string | undefined): number | null {
  if (!v || v === NEW_CATEGORY) {
    return null;
  }
  return Number(v);
}

/** Ersetzt in einer Liste das Element an Position index. */
function replaceAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, j) => {
    if (j === index) {
      return { ...item, ...patch };
    }
    return item;
  });
}

function nullIfEmpty(v: string): string | null {
  if (v.trim() === '') {
    return null;
  }
  return v.trim();
}

export function ExpenseFormPage() {
  const { id } = useParams();
  const editId = toNumberOrNull(id);
  const isEdit = editId !== null;
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/expenses');
    }
  };
  const queryClient = useQueryClient();
  const { t, lang } = useI18n();
  const relative = useRelativeDays();
  const [toast, showToast] = useToast();

  const expense = useQuery({ queryKey: ['expense', editId], queryFn: () => api.expense(editId as number), enabled: isEdit });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const deadlines = useQuery({ queryKey: ['deadlines'], queryFn: api.deadlines, enabled: isEdit });
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const currency = me.data?.currency ?? 'EUR';

  const [form, setForm] = useState<FormState>(initialState);
  const [loaded, setLoaded] = useState(!isEdit);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'amount' | 'payouts', string>>>({});
  const [newCategory, setNewCategory] = useState('');
  const [price, setPrice] = useState({ validFrom: '', amount: '', note: '' });

  useEffect(() => {
    if (expense.data && !loaded) {
      setForm(fromExpense(expense.data, lang));
      setLoaded(true);
    }
  }, [expense.data, loaded, lang]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setContract = <K extends keyof Contract>(key: K, value: Contract[K]) => setForm((f) => ({ ...f, contract: { ...f.contract, [key]: value } }));

  const amountCents = parseMoneyInput(form.amount);
  const preview = useMemo(() => {
    if (!form.firstDueDate) {
      return [];
    }
    return nextDueDates(form.firstDueDate, form.frequency, todayIso(), 4, nullIfEmpty(form.endDate));
  }, [form.firstDueDate, form.frequency, form.endDate]);

  const invalidateAll = () => queryClient.invalidateQueries();

  const save = useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (isEdit) {
        return api.updateExpense(editId as number, input);
      }
      return api.createExpense(input);
    },
    onSuccess: async () => {
      await invalidateAll();
      close();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteExpense(editId as number),
    onSuccess: async () => {
      // Gelöschte Ausgabe nicht erneut laden (sonst 404)
      queryClient.removeQueries({ queryKey: ['expense', editId] });
      close();
      await invalidateAll();
    },
  });

  const createCategory = useMutation({
    mutationFn: (name: string) => api.createCategory({ name, color: '#64748b' }),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      set('categoryId', String(c.id));
      setNewCategory('');
    },
  });

  const addPrice = useMutation({
    mutationFn: (p: { validFrom: string; amountCents: number; note: string | null }) => api.addPriceChange(editId as number, p),
    onSuccess: async () => {
      setPrice({ validFrom: '', amount: '', note: '' });
      await invalidateAll();
      showToast(t('common.saved'));
    },
  });

  const removePrice = useMutation({
    mutationFn: (changeId: number) => api.removePriceChange(editId as number, changeId),
    onSuccess: invalidateAll,
  });

  if (isEdit && expense.error) {
    return <ErrorBox error={expense.error} />;
  }
  if (!loaded) {
    return <Loading />;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (form.name.trim() === '') {
      nextErrors.name = t('form.required');
    }
    if (amountCents === null || amountCents < 0) {
      nextErrors.amount = t('form.invalidAmount');
    }
    const payouts = [];
    if (form.hasPayouts) {
      for (const p of form.payouts) {
        const cents = parseMoneyInput(p.amount);
        if (!p.date || cents === null || cents < 0) {
          nextErrors.payouts = t('form.invalidAmount');
          break;
        }
        payouts.push({ date: p.date, amountCents: cents, received: p.received });
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    let contract: Contract | null = null;
    if (form.hasContract) {
      let cancelledOn: string | null = null;
      if (form.contract.cancelled) {
        cancelledOn = form.contract.cancelledOn || null;
      }
      contract = { ...form.contract, endDate: form.contract.endDate || null, cancelledOn };
    }
    save.mutate({
      name: form.name.trim(),
      provider: nullIfEmpty(form.provider),
      categoryId: toNumberOrNull(form.categoryId),
      amountCents: amountCents as number,
      frequency: form.frequency,
      firstDueDate: form.firstDueDate,
      endDate: nullIfEmpty(form.endDate),
      paymentMethod: nullIfEmpty(form.paymentMethod),
      active: form.active,
      note: nullIfEmpty(form.note),
      contract,
      payouts,
    });
  };

  const deadline = deadlines.data?.find((d) => d.expenseId === editId);
  const renewLabel = (n: number) => {
    if (n === 0) {
      return t('form.renewNone');
    }
    return t('form.renewMonths', { n });
  };
  const priceCents = parseMoneyInput(price.amount);

  let title: MessageKey = 'form.titleNew';
  if (isEdit) {
    title = 'form.titleEdit';
  }
  let amountLabel: MessageKey = 'form.amount';
  if (isEdit && (expense.data?.priceChanges.length ?? 0) > 0) {
    amountLabel = 'form.amountBase';
  }

  const tint = (color: string): CSSProperties => ({ ['--c' as string]: color } as CSSProperties);
  let monthlyHint = '';
  if (amountCents !== null && amountCents > 0 && form.frequency !== 'MONTHLY') {
    monthlyHint = t('form.amountHint', { amount: money(monthlyCost(amountCents, form.frequency), lang, currency) });
  }
  let contractSummary = t('common.none');
  if (form.hasContract) {
    contractSummary = `${form.contract.noticeValue} ${t(`unit.${form.contract.noticeUnit}`)}`;
    if (form.contract.cancelled) {
      contractSummary = t('list.cancelled');
    }
  }
  let payoutSummary = t('common.none');
  if (form.hasPayouts && form.payouts.length > 0) {
    payoutSummary = String(form.payouts.length);
  }
  let pricesSummary = '—';
  if (expense.data && expense.data.priceChanges.length > 0) {
    pricesSummary = String(expense.data.priceChanges.length);
  }

  return (
    <div className="sheet-page" onClick={(e) => { if (e.target === e.currentTarget) { close(); } }}>
      <form className="sheet" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <span className="handle" aria-hidden="true" />
        <div className="page-title" style={{ minHeight: 40 }}>
          <h1 id="sheet-title" style={{ fontSize: 24 }}>{t(title)}</h1>
          <button type="button" className="btn btn-ghost" onClick={close}>{t('common.cancel')}</button>
        </div>

        {save.error && <ErrorBox error={save.error} />}

        <label className="amount-input">
          <span className="small muted">{t(amountLabel)}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <input inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => set('amount', e.target.value)} aria-invalid={Boolean(errors.amount)} aria-label={t(amountLabel)} style={{ width: `${Math.max(4, form.amount.length) * 0.56}em` }} />
            <span className="currency">€</span>
          </span>
          <span className="small" style={{ color: 'var(--sage-muted)', minHeight: 18 }}>{monthlyHint}</span>
          {errors.amount && <span className="field-error">{errors.amount}</span>}
        </label>

        <div className="segmented" role="radiogroup" aria-label={t('form.frequency')}>
          {FREQUENCIES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={form.frequency === f} onClick={() => set('frequency', f)}>{t(`freq.short.${f}`)}</button>
          ))}
        </div>

        <label className="field">
          <span>{t('form.name')}</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(errors.name)} required />
        </label>
        {errors.name && <span className="field-error">{errors.name}</span>}
        <DateField label={t('form.firstDue')} value={form.firstDueDate} onChange={(v) => set('firstDueDate', v)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="small muted">{t('form.category')}</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {(categories.data ?? []).map((c) => (
              <button key={c.id} type="button" className="chip tint" style={tint(c.color)} aria-pressed={form.categoryId === String(c.id)} onClick={() => set('categoryId', String(c.id))}>{c.name}</button>
            ))}
            <button type="button" className="chip" aria-pressed={form.categoryId === NEW_CATEGORY} onClick={() => set('categoryId', NEW_CATEGORY)}>{t('form.newCategory')}</button>
          </div>
          {form.categoryId === NEW_CATEGORY && (
            <div className="field" style={{ paddingRight: 6 }}>
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder={t('form.newCategoryPrompt')} aria-label={t('form.newCategoryPrompt')} style={{ textAlign: 'left' }} autoFocus />
              <button type="button" className="btn btn-small btn-primary" disabled={newCategory.trim() === '' || createCategory.isPending} onClick={() => createCategory.mutate(newCategory.trim())}>{t('common.add')}</button>
            </div>
          )}
        </div>

        <details className="fold">
          <summary><span>{t('form.more')}</span><span className="muted small">{form.provider || ''}</span></summary>
          <div className="fold-body">
            <label className="field"><span>{t('form.provider')}</span><input value={form.provider} onChange={(e) => set('provider', e.target.value)} /></label>
            <label className="field">
              <span>{t('form.paymentMethod')}</span>
              <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`form.pm.${m}` as MessageKey)}</option>)}
              </select>
            </label>
            <DateField label={t('form.lastDue')} value={form.endDate} min={form.firstDueDate} clearable onChange={(v) => set('endDate', v)} />
            <span className="small muted" style={{ padding: '0 6px' }}>{t('form.lastDueHint')}</span>
            <textarea className="textarea" style={{ background: 'var(--surface)' }} placeholder={t('form.note')} aria-label={t('form.note')} value={form.note} onChange={(e) => set('note', e.target.value)} />
            <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />{t('form.active')}</label>
          </div>
        </details>

        <details className="fold" open={form.hasContract && Boolean(deadline)}>
          <summary><span>{t('form.contract')}</span><span className="muted small">{contractSummary}</span></summary>
          <div className="fold-body">
            <div className="row" style={{ padding: '0 6px', minHeight: 44 }}>
              <span className="main"><span className="sub">{t('form.contractHint')}</span></span>
              <Switch checked={form.hasContract} onChange={(v) => set('hasContract', v)} label={t('form.contract')} />
            </div>
            {form.hasContract && (
              <>
                <DateField label={t('form.contractStart')} value={form.contract.startDate} onChange={(v) => setContract('startDate', v)} />
                <DateField label={t('form.contractEnd')} value={form.contract.endDate ?? ''} clearable onChange={(v) => setContract('endDate', v || null)} />
                <div className="field">
                  <span>{t('form.notice')}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" min={0} max={36} value={form.contract.noticeValue} onChange={(e) => setContract('noticeValue', Number(e.target.value))} aria-label={t('form.notice')} style={{ width: 48 }} />
                    <select value={form.contract.noticeUnit} onChange={(e) => setContract('noticeUnit', e.target.value as NoticeUnit)} aria-label={t('form.notice')}>
                      {UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
                    </select>
                  </span>
                </div>
                <label className="field">
                  <span>{t('form.autoRenew')}</span>
                  <select value={form.contract.autoRenewMonths} onChange={(e) => setContract('autoRenewMonths', Number(e.target.value))}>
                    {RENEWALS.map((n) => <option key={n} value={n}>{renewLabel(n)}</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={form.contract.consumerContract} onChange={(e) => setContract('consumerContract', e.target.checked)} />{t('form.consumer')}</label>
                <label className="check"><input type="checkbox" checked={form.contract.cancelled} onChange={(e) => setContract('cancelled', e.target.checked)} />{t('form.cancelled')}</label>
                {form.contract.cancelled && (
                  <DateField label={t('form.cancelledOn')} value={form.contract.cancelledOn ?? ''} clearable onChange={(v) => setContract('cancelledOn', v || null)} />
                )}
                {deadline && deadline.cancellationDeadline && deadline.daysUntilDeadline !== null && !form.contract.cancelled && (
                  <div className="note note-peach"><span className="body"><span className="kicker">{t('form.deadlineInfo', { date: date(deadline.cancellationDeadline, lang), when: relative(deadline.daysUntilDeadline) })}</span></span></div>
                )}
                {expense.data?.contract?.cancelled && expense.data.effectiveEndDate && form.contract.cancelled && (
                  <div className="note note-sage"><span className="body"><span className="kicker">{t('form.endsInfo', { date: date(expense.data.effectiveEndDate, lang) })}</span></span></div>
                )}
              </>
            )}
          </div>
        </details>

        <details className="fold" open={form.hasPayouts}>
          <summary><span>{t('form.payouts')}</span><span className="muted small">{payoutSummary}</span></summary>
          <div className="fold-body">
            <span className="small muted" style={{ padding: '0 6px' }}>{t('form.payoutsHint')}</span>
            {form.payouts.map((p, i) => (
              <div key={i} className="card" style={{ padding: 10, gap: 8, background: 'var(--surface)', borderRadius: 16 }}>
                <DateField label={t('form.payoutDate')} value={p.date} onChange={(v) => set('payouts', replaceAt(form.payouts, i, { date: v }))} />
                <label className="field"><span>{t('form.payoutAmount')}</span><input inputMode="decimal" placeholder="0,00" value={p.amount} onChange={(e) => set('payouts', replaceAt(form.payouts, i, { amount: e.target.value }))} /></label>
                <div className="row" style={{ padding: '0 4px', minHeight: 40 }}>
                  <label className="check" style={{ flex: 1 }}><input type="checkbox" checked={p.received} onChange={(e) => set('payouts', replaceAt(form.payouts, i, { received: e.target.checked }))} />{t('form.payoutReceived')}</label>
                  <button type="button" className="icon-btn" aria-label={t('form.payoutRemove')} onClick={() => setForm((f) => ({ ...f, payouts: f.payouts.filter((_, j) => j !== i), hasPayouts: f.payouts.length > 1 }))}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            ))}
            {errors.payouts && <span className="field-error">{errors.payouts}</span>}
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setForm((f) => ({ ...f, hasPayouts: true, payouts: [...f.payouts, { date: '', amount: '', received: false }] }))}>{t('form.payoutAdd')}</button>
          </div>
        </details>

        <details className="fold">
          <summary><span>{t('form.prices')}</span><span className="muted small">{pricesSummary}</span></summary>
          <div className="fold-body">
            <span className="small muted" style={{ padding: '0 6px' }}>{t('form.pricesHint')}</span>
            {!isEdit && <span className="small muted" style={{ padding: '0 6px' }}>{t('form.pricesAfterSave')}</span>}
            {isEdit && expense.data && (
              <>
                <div className="card-flat rows">
                  <div className="row"><span className="main"><strong>{t('form.priceBase')}</strong><span className="sub">{date(expense.data.firstDueDate, lang)}</span></span><span className="num">{money(expense.data.amountCents, lang, currency)}</span></div>
                  {expense.data.priceChanges.map((c) => (
                    <div className="row" key={c.id}>
                      <span className="main"><strong>{date(c.validFrom, lang)}</strong>{c.note && <span className="sub">{c.note}</span>}</span>
                      <span className="num">{money(c.amountCents, lang, currency)}</span>
                      <button type="button" className="icon-btn" aria-label={t('common.delete')} onClick={() => removePrice.mutate(c.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  ))}
                </div>
                <DateField label={t('form.priceFrom')} value={price.validFrom} min={expense.data.firstDueDate} onChange={(v) => setPrice({ ...price, validFrom: v })} />
                <label className="field"><span>{t('form.payoutAmount')}</span><input inputMode="decimal" placeholder="0,00" value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} /></label>
                <label className="field"><span>{t('form.priceNote')}</span><input value={price.note} onChange={(e) => setPrice({ ...price, note: e.target.value })} /></label>
                <button
                  type="button"
                  className="btn"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={!price.validFrom || priceCents === null || addPrice.isPending}
                  onClick={() => addPrice.mutate({ validFrom: price.validFrom, amountCents: priceCents as number, note: nullIfEmpty(price.note) })}
                >
                  {t('common.add')}
                </button>
                {addPrice.error && <ErrorBox error={addPrice.error} />}
              </>
            )}
          </div>
        </details>

        {preview.length > 0 && (
          <span className="small muted" style={{ padding: '0 6px' }}>
            {t('form.nextDues')}: {preview.slice(0, 3).map((d) => date(d, lang)).join(' · ')}
          </span>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>{t('common.save')}</button>
        {isEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(t('common.confirmDelete', { name: form.name }))) {
                remove.mutate();
              }
            }}
          >
            {t('common.delete')}
          </button>
        )}
      </form>
      {toast}
    </div>
  );
}
