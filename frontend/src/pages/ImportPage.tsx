import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { ColumnMapping, ImportPreview, MatchSuggestion } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { Icon } from '../components/Icon';
import { ErrorBox } from '../components/ui';
import { date, money, signedMoney } from '../utils/format';
import { MessageKey } from '../i18n/messages';

function suggestionKey(s: MatchSuggestion): string {
  return `${s.transactionIndex}`;
}

export function ImportPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const currency = me.data?.currency ?? 'EUR';

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyMatched, setOnlyMatched] = useState(true);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({ dateColumn: '', amountColumn: '', counterpartyColumn: '', referenceColumn: '' });
  const [result, setResult] = useState<{ paymentsRecorded: number; payoutsReceived: number } | null>(null);

  const analyze = useMutation({
    mutationFn: (args: { file: File; mapping?: ColumnMapping }) => api.importCsv(args.file, args.mapping),
    onSuccess: (data) => {
      setPreview(data);
      setNeedsMapping(false);
      setResult(null);
      // Sichere Zuordnungen vorauswählen, unsichere muss man aktiv bestätigen
      setSelected(new Set(data.suggestions.filter((s) => s.confidence === 'HIGH').map(suggestionKey)));
    },
    onError: (err) => {
      setPreview(null);
      if (err instanceof ApiError && err.status === 400 && err.message.includes('Format')) {
        setNeedsMapping(true);
      }
    },
  });

  const confirm = useMutation({
    mutationFn: (matches: MatchSuggestion[]) =>
      api.confirmImport(
        matches.map((s) => ({
          type: s.type,
          expenseId: s.expenseId,
          targetDate: s.targetDate,
          bookingDate: s.bookingDate,
          bookedCents: s.bookedCents,
          reference: preview?.transactions[s.transactionIndex]?.reference || null,
        })),
      ),
    onSuccess: (res) => {
      setResult(res);
      setPreview(null);
      setFile(null);
      queryClient.invalidateQueries();
    },
  });

  const suggestionByTx = useMemo(() => {
    const map = new Map<number, MatchSuggestion>();
    for (const s of preview?.suggestions ?? []) {
      map.set(s.transactionIndex, s);
    }
    return map;
  }, [preview]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (file) {
      analyze.mutate({ file });
    }
  };

  const submitMapping = (e: FormEvent) => {
    e.preventDefault();
    if (file) {
      analyze.mutate({ file, mapping });
    }
  };

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const chosen = (preview?.suggestions ?? []).filter((s) => selected.has(suggestionKey(s)));
  let rows = preview?.transactions ?? [];
  if (onlyMatched) {
    rows = rows.filter((tx) => suggestionByTx.has(tx.index));
  }

  let fileLabel = t('imp.drop');
  if (file) {
    fileLabel = file.name;
  }

  return (
    <>
      <div className="page-title"><h1>{t('imp.title')}</h1></div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="dropzone">
          <Icon name="upload" size={26} strokeWidth={1.8} />
          <strong>{fileLabel}</strong>
          <span className="small muted">{t('imp.banks')}</span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-label={t('imp.choose')}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setNeedsMapping(false);
              setResult(null);
            }}
          />
        </label>
        {file && !preview && (
          <button type="submit" className="btn btn-primary btn-block" disabled={analyze.isPending}>{t('imp.analyze')}</button>
        )}
      </form>

      {analyze.error && <ErrorBox error={analyze.error} />}

      {needsMapping && (
        <form className="card" onSubmit={submitMapping}>
          <span className="card-title">{t('imp.mappingTitle')}</span>
          <span className="small muted">{t('imp.mappingHint')}</span>
          <label className="field"><span>{t('imp.colDate')}</span><input required value={mapping.dateColumn} onChange={(e) => setMapping({ ...mapping, dateColumn: e.target.value })} /></label>
          <label className="field"><span>{t('imp.colAmount')}</span><input required value={mapping.amountColumn} onChange={(e) => setMapping({ ...mapping, amountColumn: e.target.value })} /></label>
          <label className="field"><span>{t('imp.colParty')}</span><input value={mapping.counterpartyColumn} onChange={(e) => setMapping({ ...mapping, counterpartyColumn: e.target.value })} /></label>
          <label className="field"><span>{t('imp.colRef')}</span><input value={mapping.referenceColumn} onChange={(e) => setMapping({ ...mapping, referenceColumn: e.target.value })} /></label>
          <button type="submit" className="btn btn-primary" disabled={analyze.isPending}>{t('imp.retry')}</button>
        </form>
      )}

      {result && (
        <div className="note note-sage" role="status">
          <span className="body"><span className="title">{t('imp.done', { payments: result.paymentsRecorded, payouts: result.payoutsReceived })}</span></span>
        </div>
      )}

      {preview && (
        <>
          <div className="note note-sage">
            <span className="body">
              <span className="kicker">{t('imp.detected', { format: preview.format })}</span>
              <span className="small">{t('imp.matchesLine', { tx: preview.stats.transactions, n: preview.stats.suggested })}{preview.skippedRows > 0 && ' · ' + t('imp.skipped', { n: preview.skippedRows })}</span>
            </span>
          </div>
          <label className="check">
            <input type="checkbox" checked={onlyMatched} onChange={(e) => setOnlyMatched(e.target.checked)} />
            {t('imp.onlyMatched')}
          </label>
          <section className="card-flat rows" aria-label={t('imp.match')}>
            {rows.map((tx) => {
              const s = suggestionByTx.get(tx.index);
              let amountStyle = {};
              if (tx.amountCents > 0) {
                amountStyle = { color: 'var(--sage-muted)' };
              }
              if (!s) {
                return (
                  <div key={tx.index} className="row" style={{ color: 'var(--muted)' }}>
                    <span style={{ width: 26 }} />
                    <span className="main"><span>{tx.counterparty || '—'} · {date(tx.date, lang)}</span><span className="sub">{t('imp.noMatch')}</span></span>
                    <span className="num">{signedMoney(tx.amountCents, lang, currency)}</span>
                  </div>
                );
              }
              let badgeStyle = { background: 'var(--sage)', color: 'var(--sage-ink)' };
              if (s.confidence !== 'HIGH') {
                badgeStyle = { background: 'var(--peach)', color: 'var(--peach-ink)' };
              }
              return (
                <label key={tx.index} className="row row-link">
                  <input type="checkbox" className="check" style={{ width: 22, height: 22, accentColor: 'var(--sage-bar)' }} checked={selected.has(suggestionKey(s))} onChange={() => toggle(suggestionKey(s))} aria-label={`${tx.counterparty} → ${s.name}`} />
                  <span className="main">
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{tx.counterparty || '—'}</strong><span className="num" style={amountStyle}>{signedMoney(tx.amountCents, lang, currency)}</span></span>
                    <span className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {date(tx.date, lang)} → <strong style={{ color: 'var(--ink)' }}>{s.type === 'PAYOUT' && `${t('imp.payout')}: `}{s.name}</strong>
                      <span className="pill-badge" style={badgeStyle}>{t(`imp.confidence.${s.confidence}` as MessageKey)}</span>
                    </span>
                    <span className="sub">{t('imp.expected', { amount: money(s.expectedCents, lang, currency), date: date(s.targetDate, lang) })}</span>
                  </span>
                </label>
              );
            })}
          </section>
          {confirm.error && <ErrorBox error={confirm.error} />}
          <button type="button" className="btn btn-primary btn-block" disabled={chosen.length === 0 || confirm.isPending} onClick={() => confirm.mutate(chosen)}>
            {t('imp.confirmShort', { n: chosen.length })}
          </button>
        </>
      )}
    </>
  );
}
