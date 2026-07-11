import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, type Firestore } from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import type { AppUser, AppUserRole } from '../types/auth';
import { firestorePaths } from './firestore/paths';

export function getFirebaseAuth(): Auth | null {
  return auth;
}

export function getFirebaseAuthDependencies(): {
  auth: Auth | null;
  db: Firestore | null;
} {
  return { auth, db };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<void> {
  if (!auth) {
    throw new Error('firebase-auth-unavailable');
  }

  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutFromFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export async function loadApprovedAppUser(
  firestore: Firestore,
  firebaseUser: User,
): Promise<AppUser | null> {
  const snapshot = await getDoc(
    doc(firestore, firestorePaths.appUser(firebaseUser.uid)),
  );
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  if (data.active !== true) {
    return null;
  }

  return {
    uid: firebaseUser.uid,
    email:
      typeof data.email === 'string' && data.email.trim()
        ? data.email
        : firebaseUser.email,
    displayName:
      typeof data.display_name === 'string' && data.display_name.trim()
        ? data.display_name
        : firebaseUser.email || firebaseUser.uid,
    role: isAppUserRole(data.role) ? data.role : 'coordinator',
  };
}

function isAppUserRole(value: unknown): value is AppUserRole {
  return value === 'admin' || value === 'coordinator' || value === 'viewer';
}
