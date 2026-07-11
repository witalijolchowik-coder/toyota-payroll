import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { AuthContext } from '../contexts/AuthContext';
import {
  getFirebaseAuthDependencies,
  loadApprovedAppUser,
  signInWithEmailPassword,
  signOutFromFirebase,
} from '../services/authService';
import type { AppUser, AuthStatus } from '../types/auth';

export function AuthProvider({ children }: PropsWithChildren) {
  const firebaseDependencies = useMemo(() => getFirebaseAuthDependencies(), []);
  const [{ status, user }, setState] = useState<{
    status: AuthStatus;
    user: AppUser | null;
  }>({
    status:
      firebaseDependencies.auth && firebaseDependencies.db
        ? 'loading'
        : 'configuration-error',
    user: null,
  });

  useEffect(() => {
    const { auth, db } = firebaseDependencies;
    if (!auth || !db) {
      return undefined;
    }

    return onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (!firebaseUser) {
          setState({ status: 'unauthenticated', user: null });
          return;
        }

        setState({ status: 'loading', user: null });
        void loadApprovedAppUser(db, firebaseUser)
          .then((approvedUser) => {
            setState(
              approvedUser
                ? { status: 'authenticated', user: approvedUser }
                : { status: 'no-access', user: null },
            );
          })
          .catch(() => {
            setState({ status: 'no-access', user: null });
          });
      },
      () => {
        setState({ status: 'unauthenticated', user: null });
      },
    );
  }, [firebaseDependencies]);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      signIn: signInWithEmailPassword,
      signOut: signOutFromFirebase,
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
