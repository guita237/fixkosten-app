import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthHeaderProvider } from '../api/client';

export interface AuthUser {
  email: string;
}

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  devMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export const DEV_MODE = import.meta.env.VITE_AUTH_MODE === 'dev';

/** Firebase wird nur geladen, wenn nicht im Dev-Modus (kleineres Bundle beim lokalen Testen). */
async function firebaseAuth() {
  const { getFirebaseAuth } = await import('./firebase');
  return getFirebaseAuth();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_MODE) {
      setAuthHeaderProvider(async () => ({ 'x-dev-user': 'dev-user' }));
      setUser({ email: 'dev-user@localhost' });
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    firebaseAuth().then(async (auth) => {
      const { onAuthStateChanged } = await import('firebase/auth');
      setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
        const current = auth.currentUser;
        if (!current) {
          return {};
        }
        return { Authorization: `Bearer ${await current.getIdToken()}` };
      });
      unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          setUser({ email: fbUser.email ?? '' });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      devMode: DEV_MODE,
      login: async (email, password) => {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        await signInWithEmailAndPassword(await firebaseAuth(), email, password);
      },
      register: async (email, password) => {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(await firebaseAuth(), email, password);
      },
      resetPassword: async (email) => {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        await sendPasswordResetEmail(await firebaseAuth(), email);
      },
      logout: async () => {
        if (DEV_MODE) {
          return;
        }
        const { signOut } = await import('firebase/auth');
        await signOut(await firebaseAuth());
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth außerhalb von AuthProvider');
  }
  return ctx;
}
