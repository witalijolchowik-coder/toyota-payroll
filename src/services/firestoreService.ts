import type { Firestore } from 'firebase/firestore';

import { db } from '../config/firebase';

export function getFirestoreClient(): Firestore | null {
  return db;
}
