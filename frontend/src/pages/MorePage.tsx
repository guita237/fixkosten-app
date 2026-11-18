import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18n';
import { useAuth } from '../auth/Auth';
import { Icon } from '../components/Icon';

export function MorePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <>
      <div className="page-title"><h1>{t('more.title')}</h1></div>
      <div className="card-flat rows">
        <Link to="/import" className="row row-link">
          <Icon name="upload" />
          <span className="main"><strong>{t('nav.import')}</strong><span className="sub">{t('imp.banks')}</span></span>
          <span className="muted">›</span>
        </Link>
        <Link to="/settings" className="row row-link">
          <Icon name="settings" />
          <span className="main"><strong>{t('nav.settings')}</strong><span className="sub">{user?.email}</span></span>
          <span className="muted">›</span>
        </Link>
      </div>
    </>
  );
}
