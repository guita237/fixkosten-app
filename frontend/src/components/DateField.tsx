import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18n';
import { date as formatDate, todayIso } from '../utils/format';

const LOCALE: Record<string, string> = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  clearable?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Monday = 0 … Sunday = 6 */
function weekdayOfFirst(year: number, month: number): number {
  return (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
}

function startView(value: string): { year: number; month: number } {
  let source = value;
  if (!source) {
    source = todayIso();
  }
  return { year: Number(source.substring(0, 4)), month: Number(source.substring(5, 7)) - 1 };
}

export function DateField({ label, value, onChange, min, clearable }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  let shown = t('date.none');
  let shownClass = 'muted';
  if (value) {
    shown = formatDate(value, lang);
    shownClass = '';
  }

  return (
    <>
      <button type="button" className="field date-field" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span>{label}</span>
        <strong className={shownClass}>{shown}</strong>
      </button>
      {open &&
        createPortal(
          <Calendar
            label={label}
            value={value}
            min={min}
            clearable={clearable}
            locale={LOCALE[lang]}
            onClose={() => setOpen(false)}
            onPick={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}

interface CalendarProps {
  label: string;
  value: string;
  min?: string;
  clearable?: boolean;
  locale: string;
  onClose: () => void;
  onPick: (value: string) => void;
}

function Calendar({ label, value, min, clearable, locale, onClose, onPick }: CalendarProps) {
  const { t } = useI18n();
  const [view, setView] = useState(() => startView(value));
  const [monthMode, setMonthMode] = useState(false);
  const today = todayIso();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function shift(delta: number) {
    if (monthMode) {
      setView({ year: view.year + delta, month: view.month });
      return;
    }
    let month = view.month + delta;
    let year = view.year;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setView({ year, month });
  }

  const titleDate = new Date(Date.UTC(view.year, view.month, 1));
  let title = String(view.year);
  if (!monthMode) {
    title = titleDate.toLocaleDateString(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
  }

  const weekdays: string[] = [];
  for (let i = 0; i < 7; i++) {
    // 2024-01-01 was a Monday
    weekdays.push(new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'narrow' }));
  }

  const cells: (string | null)[] = [];
  for (let i = 0; i < weekdayOfFirst(view.year, view.month); i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth(view.year, view.month); d++) {
    cells.push(iso(view.year, view.month, d));
  }

  function isDisabled(day: string): boolean {
    if (min && day < min) {
      return true;
    }
    return false;
  }

  function dayClass(day: string): string {
    const classes = ['cal-day'];
    if (day === value) {
      classes.push('selected');
    }
    if (day === today) {
      classes.push('today');
    }
    return classes.join(' ');
  }

  let nextYear = view.year;
  if (view.month === 11) {
    nextYear += 1;
  }
  const nextFirst = iso(nextYear, (view.month + 1) % 12, 1);

  return (
    <div className="sheet-page cal-layer" onClick={onClose}>
      <div className="sheet cal-sheet" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        <div className="small muted">{label}</div>
        <div className="cal-head">
          <button type="button" className="cal-title" onClick={() => setMonthMode(!monthMode)} aria-expanded={monthMode}>
            {title} <span aria-hidden>⌄</span>
          </button>
          <div className="cal-nav">
            <button type="button" className="icon-btn" aria-label={t('date.prev')} onClick={() => shift(-1)}>‹</button>
            <button type="button" className="icon-btn" aria-label={t('date.next')} onClick={() => shift(1)}>›</button>
          </div>
        </div>

        {monthMode && (
          <div className="cal-months">
            {Array.from({ length: 12 }, (_, m) => {
              const name = new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { timeZone: 'UTC', month: 'short' });
              let cls = 'cal-month';
              if (m === view.month) {
                cls += ' selected';
              }
              return (
                <button
                  key={m}
                  type="button"
                  className={cls}
                  onClick={() => {
                    setView({ year: view.year, month: m });
                    setMonthMode(false);
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
        {!monthMode && (
          <div className="cal-grid">
            {weekdays.map((w, i) => (
              <span key={`w${i}`} className="cal-weekday">{w}</span>
            ))}
            {cells.map((day, i) => {
              if (!day) {
                return <span key={`e${i}`} />;
              }
              return (
                <button
                  key={day}
                  type="button"
                  className={dayClass(day)}
                  data-date={day}
                  disabled={isDisabled(day)}
                  aria-pressed={day === value}
                  onClick={() => onPick(day)}
                >
                  {Number(day.substring(8))}
                </button>
              );
            })}
          </div>
        )}

        <div className="chips cal-quick">
          <button type="button" className="chip" disabled={isDisabled(today)} onClick={() => onPick(today)}>{t('date.today')}</button>
          <button type="button" className="chip" disabled={isDisabled(nextFirst)} onClick={() => onPick(nextFirst)}>
            {t('date.firstOf', { date: new Date(Date.UTC(Number(nextFirst.substring(0, 4)), Number(nextFirst.substring(5, 7)) - 1, 1)).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' }) })}
          </button>
          {clearable && value && (
            <button type="button" className="chip" onClick={() => onPick('')}>{t('date.clear')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
