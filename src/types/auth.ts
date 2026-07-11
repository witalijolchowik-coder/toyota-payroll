export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'no-access'
  | 'configuration-error';

export type AppUserRole = 'admin' | 'coordinator' | 'viewer';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string | null;
  role: AppUserRole;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
