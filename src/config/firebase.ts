import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseOptions,
} from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';

const defaults = {
  apiKey: 'AIzaSyDN3XRaAtp6kkiykJc-6PqoLRIsCl4JqKU',
  authDomain: 'toyota-payroll.firebaseapp.com',
  projectId: 'toyota-payroll',
  storageBucket: 'toyota-payroll.firebasestorage.app',
  messagingSenderId: '632124039373',
  appId: '1:632124039373:web:3787368a2c2f30c33c4984',
  measurementId: 'G-9RQYDQ30PS',
} as const;

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaults.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaults.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    defaults.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaults.appId,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaults.measurementId,
};

export const firebaseConfigurationComplete = Boolean(firebaseConfig.apiKey);

const app = firebaseConfigurationComplete
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;

const useEmulators =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS?.toLowerCase() === 'true';

declare global {
  var __TOYOTA_FIREBASE_EMULATORS_CONNECTED__: boolean | undefined;
}

if (
  useEmulators &&
  auth &&
  db &&
  storage &&
  !globalThis.__TOYOTA_FIREBASE_EMULATORS_CONNECTED__
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  globalThis.__TOYOTA_FIREBASE_EMULATORS_CONNECTED__ = true;
}
