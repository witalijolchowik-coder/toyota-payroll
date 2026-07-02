import { useMemo, type PropsWithChildren } from 'react';

import { AuthContext } from '../contexts/AuthContext';
import type { AppUser } from '../types/auth';

const temporaryShellUser: AppUser = {
  uid: 'application-shell-user',
  displayName: 'Payroll Coordinator',
  email: null,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const value = useMemo(
    () => ({
      status: 'authenticated' as const,
      user: temporaryShellUser,
      isAuthenticated: true,
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
