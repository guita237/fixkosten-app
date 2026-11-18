import { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { CategoryTotal } from '../api/types';
import { useI18n } from '../i18n/I18n';
import { money, percent } from '../utils/format';

function tintStyle(color: string): CSSProperties {
  return { ['--c' as string]: color } as CSSProperties;
}

function tileLink(c: CategoryTotal): string {
  if (c.categoryId === null) {
    return '/expenses';
  }
  return `/expenses?category=${c.categoryId}`;
}

/**
 * Mosaik: größte Kategorie links, die nächsten rechts; alles ab der fünften wird zu "+n weitere".
 * Flächen sind ungefähr proportional, die Beschriftung bleibt immer lesbar.
 */
export function Mosaic({ items, total, currency }: { items: CategoryTotal[]; total: number; currency: string }) {
  const { t, lang } = useI18n();
  const named = (c: CategoryTotal) => {
    if (c.categoryId === null) {
      return t('common.noCategory');
    }
    return c.name;
  };
  const whole = (cents: number) => money(Math.round(cents / 100) * 100, lang, currency).replace(/[.,]00(?=\s?€|$)/, '');

  if (items.length === 0) {
    return null;
  }
  const [first, second, third, fourth, ...rest] = items;
  const restSum = rest.reduce((s, c) => s + c.monthlyCents, 0);

  if (!second) {
    return (
      <div className="mosaic" style={{ gridTemplateColumns: '1fr' }}>
        <Link to={tileLink(first)} className="tile tint" style={tintStyle(first.color)}>
          <span className="label">{named(first)}</span>
          <span className="value" style={{ fontSize: 34 }}>{whole(first.monthlyCents)}</span>
        </Link>
      </div>
    );
  }

  let pairColumns = '1fr';
  if (fourth) {
    pairColumns = '1fr 1fr';
  }
  let rows = '1fr';
  if (third) {
    rows = '1.25fr 1fr';
  }
  if (third && rest.length > 0) {
    rows = '1.25fr 1fr 0.8fr';
  }

  return (
    <div className="mosaic">
      <Link to={tileLink(first)} className="tile tint" style={tintStyle(first.color)}>
        <span className="label">{named(first)}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="value" style={{ fontSize: 34 }}>{whole(first.monthlyCents)}</span>
          <span className="small" style={{ opacity: 0.8 }}>{percent(first.monthlyCents, total, lang)}</span>
        </span>
      </Link>
      <div className="side" style={{ gridTemplateRows: rows }}>
        <Link to={tileLink(second)} className="tile tint" style={{ ...tintStyle(second.color), flexDirection: 'row', alignItems: 'flex-end' }}>
          <span className="label" style={{ flex: 1 }}>{named(second)}</span>
          <span className="value" style={{ fontSize: 20 }}>{whole(second.monthlyCents)}</span>
        </Link>
        {third && (
          <div className="pair" style={{ gridTemplateColumns: pairColumns }}>
            {[third, fourth].filter(Boolean).map((c) => (
              <Link key={c!.categoryId ?? 'none'} to={tileLink(c!)} className="tile tint" style={tintStyle(c!.color)}>
                <span className="label">{named(c!)}</span>
                <span className="value" style={{ fontSize: 16 }}>{whole(c!.monthlyCents)}</span>
              </Link>
            ))}
          </div>
        )}
        {rest.length > 0 && (
          <Link to="/expenses" className="tile others">
            <span className="label" style={{ flex: 1 }}>{t('dash.others', { n: rest.length })}</span>
            <span className="value" style={{ fontSize: 15 }}>{whole(restSum)}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
