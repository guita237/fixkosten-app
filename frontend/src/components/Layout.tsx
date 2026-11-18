import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18n';
import { MessageKey } from '../i18n/messages';
import { Icon } from './Icon';

const TABS: { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/', label: 'nav.month', end: true },
  { to: '/expenses', label: 'nav.expenses' },
  { to: '/payments', label: 'nav.payments' },
  { to: '/more', label: 'nav.more' },
];

const DESKTOP: { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/', label: 'nav.month', end: true },
  { to: '/expenses', label: 'nav.expenses' },
  { to: '/payments', label: 'nav.payments' },
  { to: '/import', label: 'nav.import' },
  { to: '/settings', label: 'nav.settings' },
];

function navClass({ isActive }: { isActive: boolean }): string {
  if (isActive) {
    return 'active';
  }
  return '';
}

export function Layout() {
  const { t } = useI18n();
  const location = useLocation();
  // "Mehr" bleibt aktiv, wenn Import oder Einstellungen offen sind
  const inMore = location.pathname.startsWith('/import') || location.pathname.startsWith('/settings');
  const showFab = !location.pathname.startsWith('/expenses/');

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">fixkosten</span>
        <nav className="pillnav topnav" aria-label="Hauptnavigation">
          {DESKTOP.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>{t(item.label)}</NavLink>
          ))}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      {showFab && (
        <NavLink to="/expenses/new" className="fab" aria-label={t('dash.newExpense')}>
          <Icon name="plus" size={24} strokeWidth={2.2} />
        </NavLink>
      )}

      <nav className="pillnav tabbar" aria-label="Hauptnavigation">
        {TABS.map((item) => {
          let className = navClass;
          if (item.to === '/more' && inMore) {
            className = () => 'active';
          }
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={className}>{t(item.label)}</NavLink>
          );
        })}
      </nav>
    </div>
  );
}
