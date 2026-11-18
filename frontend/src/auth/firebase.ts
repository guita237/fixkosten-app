import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

let auth: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
  }
  return auth;
}
