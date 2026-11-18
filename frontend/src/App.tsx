import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth/Auth';
import { useI18n } from './i18n/I18n';
import { api } from './api/client';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ExpenseFormPage } from './pages/ExpenseFormPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { MorePage } from './pages/MorePage';

/** Übernimmt einmalig die im Backend gespeicherte Sprache. */
function useServerLanguage() {
  const { setLang } = useI18n();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const applied = useRef(false);
  useEffect(() => {
    if (me.data && !applied.current) {
      applied.current = true;
      setLang(me.data.language);
    }
  }, [me.data, setLang]);
}

function AuthenticatedApp() {
  useServerLanguage();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<ExpenseFormPage />} />
        <Route path="expenses/:id" element={<ExpenseFormPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Loading />;
  }
  if (!user) {
    return <LoginPage />;
  }
  return <AuthenticatedApp />;
}
