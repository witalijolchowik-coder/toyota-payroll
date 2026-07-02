import type { Auth } from 'firebase/auth';

import { auth } from '../config/firebase';

export function getFirebaseAuth(): Auth | null {
  return auth;
}
