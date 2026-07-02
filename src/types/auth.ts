export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  isAuthenticated: boolean;
}
