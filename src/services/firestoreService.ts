import type { Firestore } from 'firebase/firestore';

import { db } from '../config/firebase';
import {
  createFirestoreRepositoryBoundaries,
  type FirestoreRepositoryBoundaries,
} from './firestore/repositories';

export function getFirestoreClient(): Firestore | null {
  return db;
}

export function getFirestoreRepositories(): FirestoreRepositoryBoundaries | null {
  return db ? createFirestoreRepositoryBoundaries(db) : null;
}
