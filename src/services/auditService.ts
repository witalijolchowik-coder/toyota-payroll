import {
  addDoc,
  doc,
  serverTimestamp,
  type WithFieldValue,
  type WriteBatch,
} from 'firebase/firestore';

import type { AuditAction, AuditLogDocument } from '../types/firestore';
import type { FirestoreRepositoryBoundaries } from './firestore/repositories';
import { getFirestoreRepositories } from './firestoreService';

export interface AuditEntryInput {
  entityPath: string;
  action: AuditAction;
  actorUid: string;
  changes: Record<string, unknown>;
}

function auditDocument(
  input: AuditEntryInput,
): WithFieldValue<AuditLogDocument> {
  return {
    entity_path: input.entityPath,
    action: input.action,
    actor_uid: input.actorUid,
    occurred_at: serverTimestamp(),
    changes: input.changes,
  };
}

export function appendAuditEntryToBatch(
  batch: WriteBatch,
  repositories: FirestoreRepositoryBoundaries,
  input: AuditEntryInput,
): void {
  batch.set(doc(repositories.auditLog), auditDocument(input));
}

export async function recordAuditEntry(input: AuditEntryInput): Promise<void> {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new Error('firebase-unavailable');
  }
  await addDoc(repositories.auditLog, auditDocument(input));
}
