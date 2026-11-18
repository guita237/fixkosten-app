import { ReactNode, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n/I18n';

export function Loading() {
  const { t } = useI18n();
  return <div className="center" role="status">{t('common.loading')}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n();
  let message = String(error);
  if (error instanceof ApiError || error instanceof Error) {
    message = error.message;
  }
  return (
    <div className="error-box" role="alert">{t('common.error', { message })}</div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Monatswechsler ‹ November › */
export function MonthSwitch({ label, onPrev, onNext, prevLabel, nextLabel }: { label: string; onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string }) {
  return (
    <div className="month-switch">
      <button type="button" className="icon-btn" aria-label={prevLabel} onClick={onPrev}>‹</button>
      <span>{label}</span>
      <button type="button" className="icon-btn" aria-label={nextLabel} onClick={onNext}>›</button>
    </div>
  );
}

/** Betrag als große Serifenzahl mit kleinen Cents: 1.839,12 € */
export function BigMoney({ text }: { text: string }) {
  const match = /^(.*?)([.,]\d{2})(\s?€.*)?$/.exec(text);
  if (!match) {
    return <span className="big-number">{text}</span>;
  }
  return (
    <span className="big-number">
      {match[1]}
      <span className="cents">{match[2]}{match[3] ?? ''}</span>
    </span>
  );
}

/** Kurzer Hinweis unten rechts, verschwindet nach 3 s. */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);
  let node: ReactNode = null;
  if (message) {
    node = <div className="toast" role="status">{message}</div>;
  }
  return [node, setMessage];
}

/** "heute" / "morgen" / "in 5 Tagen" / "vor 3 Tagen" */
export function useRelativeDays() {
  const { t } = useI18n();
  return (days: number) => {
    if (days === 0) {
      return t('common.today');
    } else if (days === 1) {
      return t('common.tomorrow');
    } else if (days < 0) {
      return t('common.daysAgo', { n: -days });
    }
    return t('common.inDays', { n: days });
  };
}
