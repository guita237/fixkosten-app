import admin from 'firebase-admin';

let initialized = false;

export function getFirebaseAuth(): admin.auth.Auth {
  if (!initialized) {
    // Erwartet GOOGLE_APPLICATION_CREDENTIALS (Pfad zur Service-Account-JSON)
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    initialized = true;
  }
  return admin.auth();
}

/** Dev-Modus: ohne Firebase lokal testen. In Produktion nie aktiv. */
export function isDevAuth(): boolean {
  return process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production';
}
