import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Timestamp,
  type WriteBatch,
  writeBatch,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type { MonthId } from '../types/firestore';
import { getPayrollMonthDateRange, dateToIsoDate } from '../utils/payroll';
import { recordAuditEntry } from './auditService';
import { firestorePaths } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';

const RECOVERY_INTERVAL_MS = 2 * 60 * 60 * 1_000;
const MAX_RECOVERY_POINTS = 3;
const MAX_ATOMIC_RESTORE_OPERATIONS = 450;

interface RecoverySnapshotItem {
  id: string;
  data: DocumentData;
}

interface MonthlyRecoverySnapshot {
  dailyValues: RecoverySnapshotItem[];
  manualAbsences: RecoverySnapshotItem[];
  scheduleCorrections: RecoverySnapshotItem[];
  adjustments: RecoverySnapshotItem[];
  reviewStates: RecoverySnapshotItem[];
  employeeSettlements: RecoverySnapshotItem[];
  employeeAssignments: RecoverySnapshotItem[];
  employeeEntitlements: RecoverySnapshotItem[];
}

interface RecoveryPointDocument {
  month_id: MonthId;
  input_hash: string;
  created_at: Timestamp;
  created_by: string;
  item_count: number;
  summary: Record<string, number>;
  snapshot: MonthlyRecoverySnapshot;
}

export interface MonthlyRecoveryPoint {
  id: string;
  monthId: MonthId;
  inputHash: string;
  createdAt: Date;
  itemCount: number;
  summary: Record<string, number>;
}

export type RecoveryPointCreationResult =
  'created' | 'unchanged' | 'not-due' | 'locked';

export function recoveryPointCreationDecision({
  latestInputHash,
  latestCreatedAt,
  inputHash,
  now,
  force,
}: {
  latestInputHash: string | null;
  latestCreatedAt: Date | null;
  inputHash: string;
  now: Date;
  force: boolean;
}): Exclude<RecoveryPointCreationResult, 'locked'> {
  if (latestInputHash === inputHash) return 'unchanged';
  if (
    !force &&
    latestCreatedAt &&
    now.getTime() - latestCreatedAt.getTime() < RECOVERY_INTERVAL_MS
  ) {
    return 'not-due';
  }
  return 'created';
}

function requireContext() {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  const actorUid = auth?.currentUser?.uid;
  if (!firestore || !repositories || !actorUid) {
    throw new Error('recovery-unavailable');
  }
  return { firestore, repositories, actorUid };
}

export async function listMonthlyRecoveryPoints(
  monthId: MonthId,
): Promise<MonthlyRecoveryPoint[]> {
  const { firestore } = requireContext();
  const snapshot = await getDocs(
    query(
      collection(firestore, firestorePaths.recoveryPoints(monthId)),
      orderBy('created_at', 'desc'),
      limit(MAX_RECOVERY_POINTS),
    ),
  );
  return snapshot.docs.map((item) => mapRecoveryPoint(item));
}

export async function ensureMonthlyRecoveryPoint({
  monthId,
  inputHash,
  force = false,
}: {
  monthId: MonthId;
  inputHash: string;
  force?: boolean;
}): Promise<RecoveryPointCreationResult> {
  const { firestore, repositories, actorUid } = requireContext();
  const monthSnapshot = await getDoc(repositories.forMonth(monthId).month);
  if (!monthSnapshot.exists()) throw new Error('month-unavailable');
  if (monthSnapshot.data().is_settled) return 'locked';

  const recoveryCollection = collection(
    firestore,
    firestorePaths.recoveryPoints(monthId),
  );
  const existing = await getDocs(
    query(recoveryCollection, orderBy('created_at', 'desc'), limit(4)),
  );
  const latest = existing.docs[0];
  const decision = recoveryPointCreationDecision({
    latestInputHash: latest?.data().input_hash ?? null,
    latestCreatedAt: latest?.data().created_at
      ? (latest.data().created_at as Timestamp).toDate()
      : null,
    inputHash,
    now: new Date(),
    force,
  });
  if (decision !== 'created') return decision;

  const snapshot = await loadRecoverySnapshot(monthId);
  const summary = snapshotSummary(snapshot);
  const itemCount = Object.values(summary).reduce(
    (total, count) => total + count,
    0,
  );
  const created = await addDoc(recoveryCollection, {
    month_id: monthId,
    input_hash: inputHash,
    created_at: serverTimestamp(),
    created_by: actorUid,
    item_count: itemCount,
    summary,
    snapshot,
  });

  const afterCreate = await getDocs(
    query(recoveryCollection, orderBy('created_at', 'desc')),
  );
  await Promise.all(
    afterCreate.docs
      .slice(MAX_RECOVERY_POINTS)
      .map((item) => deleteDoc(item.ref)),
  );
  await recordAuditEntry({
    entityPath: created.path,
    action: 'create',
    actorUid,
    changes: {
      operation: 'monthly-recovery-point-created',
      month_id: monthId,
      input_hash: inputHash,
      item_count: itemCount,
    },
  });
  return 'created';
}

export async function restoreMonthlyRecoveryPoint(
  monthId: MonthId,
  recoveryPointId: string,
): Promise<void> {
  const { firestore, repositories, actorUid } = requireContext();
  const monthReference = repositories.forMonth(monthId).month;
  const [monthSnapshot, recoverySnapshot] = await Promise.all([
    getDoc(monthReference),
    getDoc(
      doc(firestore, firestorePaths.recoveryPoint(monthId, recoveryPointId)),
    ),
  ]);
  if (!monthSnapshot.exists() || !recoverySnapshot.exists()) {
    throw new Error('recovery-point-unavailable');
  }
  if (monthSnapshot.data().is_settled) throw new Error('month-locked');

  const recovery = recoverySnapshot.data() as RecoveryPointDocument;
  const current = await loadRecoverySnapshot(monthId, true, false);
  const operations: Array<(batch: WriteBatch) => void> = [];

  queueMutableCollectionRestore({
    operations,
    collectionPath: firestorePaths.dailyValues(monthId),
    snapshotItems: recovery.snapshot.dailyValues.filter(
      (item) => item.data.source === 'manual',
    ),
    currentItems: current.dailyValues.filter(
      (item) => item.data.source === 'manual',
    ),
    removeCurrent: (batch, reference) => batch.delete(reference),
    actorUid,
  });
  queueImportedAttendanceOverlayRestore({
    operations,
    collectionPath: firestorePaths.dailyValues(monthId),
    snapshotItems: recovery.snapshot.dailyValues,
    currentItems: current.dailyValues,
    actorUid,
  });
  queueStatusCollectionRestore({
    operations,
    collectionPath: firestorePaths.absences(monthId),
    snapshotItems: recovery.snapshot.manualAbsences,
    currentItems: current.manualAbsences,
    actorUid,
  });
  queueStatusCollectionRestore({
    operations,
    collectionPath: firestorePaths.scheduleCorrections(monthId),
    snapshotItems: recovery.snapshot.scheduleCorrections,
    currentItems: current.scheduleCorrections,
    actorUid,
  });
  queueStatusCollectionRestore({
    operations,
    collectionPath: firestorePaths.adjustments(monthId),
    snapshotItems: recovery.snapshot.adjustments,
    currentItems: current.adjustments,
    actorUid,
  });
  queueReviewRestore({
    operations,
    collectionPath: firestorePaths.reviewStates(monthId),
    snapshotItems: recovery.snapshot.reviewStates,
    currentItems: current.reviewStates,
    actorUid,
  });
  queueSettlementRestore({
    operations,
    collectionPath: firestorePaths.employeeSettlements(monthId),
    snapshotItems: recovery.snapshot.employeeSettlements,
    currentItems: current.employeeSettlements,
  });
  queueStatusCollectionRestore({
    operations,
    collectionPath: firestorePaths.employeeAssignments,
    snapshotItems: recovery.snapshot.employeeAssignments,
    currentItems: current.employeeAssignments,
    actorUid,
  });
  queueStatusCollectionRestore({
    operations,
    collectionPath: firestorePaths.employeeEntitlements,
    snapshotItems: recovery.snapshot.employeeEntitlements,
    currentItems: current.employeeEntitlements,
    actorUid,
  });

  operations.push((batch) =>
    batch.update(monthReference, {
      calculation_status: 'queued',
      calculation_input_hash: null,
      calculation_run_id: null,
      calculation_error: null,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    }),
  );
  operations.push((batch) =>
    batch.set(doc(repositories.auditLog), {
      entity_path: firestorePaths.month(monthId),
      action: 'update',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        operation: 'monthly-recovery-restored',
        month_id: monthId,
        recovery_point_id: recoveryPointId,
        recovery_input_hash: recovery.input_hash,
        item_count: recovery.item_count,
      },
    }),
  );

  if (operations.length > MAX_ATOMIC_RESTORE_OPERATIONS) {
    throw new Error('recovery-point-too-large');
  }
  const batch = writeBatch(firestore);
  operations.forEach((operation) => operation(batch));
  await batch.commit();
}

async function loadRecoverySnapshot(
  monthId: MonthId,
  includeSettlements = true,
  activeOnly = true,
): Promise<MonthlyRecoverySnapshot> {
  const [
    dailyValues,
    absences,
    scheduleCorrections,
    adjustments,
    reviewStates,
    employeeSettlements,
    employeeAssignments,
    employeeEntitlements,
  ] = await Promise.all([
    snapshotPath(firestorePaths.dailyValues(monthId)),
    snapshotPath(firestorePaths.absences(monthId)),
    snapshotPath(firestorePaths.scheduleCorrections(monthId)),
    snapshotPath(firestorePaths.adjustments(monthId)),
    snapshotPath(firestorePaths.reviewStates(monthId)),
    includeSettlements
      ? snapshotPath(firestorePaths.employeeSettlements(monthId))
      : Promise.resolve([]),
    snapshotPath(firestorePaths.employeeAssignments),
    snapshotPath(firestorePaths.employeeEntitlements),
  ]);
  const range = getPayrollMonthDateRange(monthId);
  const monthStart = dateToIsoDate(range.start);
  const monthEnd = dateToIsoDate(range.end);
  const overlapsMonth = (item: RecoverySnapshotItem) =>
    item.data.valid_from <= monthEnd &&
    (item.data.valid_to == null || item.data.valid_to >= monthStart);

  return {
    dailyValues,
    manualAbsences: absences.filter(
      (item) =>
        item.data.source === 'manual' &&
        (!activeOnly || item.data.status === 'ACTIVE'),
    ),
    scheduleCorrections: scheduleCorrections.filter(
      (item) => !activeOnly || item.data.status === 'ACTIVE',
    ),
    adjustments: adjustments.filter(
      (item) => !activeOnly || item.data.status === 'ACTIVE',
    ),
    reviewStates,
    employeeSettlements,
    employeeAssignments: employeeAssignments.filter(
      (item) =>
        (!activeOnly || item.data.status === 'ACTIVE') && overlapsMonth(item),
    ),
    employeeEntitlements: employeeEntitlements.filter(
      (item) =>
        (!activeOnly || item.data.status === 'ACTIVE') && overlapsMonth(item),
    ),
  };
}

async function snapshotPath(path: string): Promise<RecoverySnapshotItem[]> {
  const { firestore } = requireContext();
  const snapshot = await getDocs(collection(firestore, path));
  return snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
}

function snapshotSummary(snapshot: MonthlyRecoverySnapshot) {
  return Object.fromEntries(
    Object.entries(snapshot).map(([key, items]) => [key, items.length]),
  );
}

function mapRecoveryPoint(
  item: QueryDocumentSnapshot<DocumentData>,
): MonthlyRecoveryPoint {
  const data = item.data() as RecoveryPointDocument;
  return {
    id: item.id,
    monthId: data.month_id,
    inputHash: data.input_hash,
    createdAt: data.created_at.toDate(),
    itemCount: data.item_count,
    summary: data.summary,
  };
}

function queueMutableCollectionRestore({
  operations,
  collectionPath,
  snapshotItems,
  currentItems,
  removeCurrent,
  actorUid,
}: {
  operations: Array<(batch: WriteBatch) => void>;
  collectionPath: string;
  snapshotItems: RecoverySnapshotItem[];
  currentItems: RecoverySnapshotItem[];
  removeCurrent: (batch: WriteBatch, reference: DocumentReference) => void;
  actorUid: string;
}) {
  const { firestore } = requireContext();
  const snapshotById = new Map(snapshotItems.map((item) => [item.id, item]));
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  currentItems.forEach((item) => {
    if (!snapshotById.has(item.id)) {
      operations.push((batch) =>
        removeCurrent(batch, doc(firestore, collectionPath, item.id)),
      );
    }
  });
  snapshotItems.forEach((item) => {
    const current = currentById.get(item.id);
    operations.push((batch) =>
      batch.set(
        doc(firestore, collectionPath, item.id),
        restoredMetadata(item.data, current?.data, actorUid),
      ),
    );
  });
}

function queueStatusCollectionRestore({
  operations,
  collectionPath,
  snapshotItems,
  currentItems,
  actorUid,
}: {
  operations: Array<(batch: WriteBatch) => void>;
  collectionPath: string;
  snapshotItems: RecoverySnapshotItem[];
  currentItems: RecoverySnapshotItem[];
  actorUid: string;
}) {
  const { firestore } = requireContext();
  const snapshotIds = new Set(snapshotItems.map((item) => item.id));
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  currentItems.forEach((item) => {
    if (!snapshotIds.has(item.id) && item.data.status === 'ACTIVE') {
      operations.push((batch) =>
        batch.update(doc(firestore, collectionPath, item.id), {
          status: 'CANCELLED',
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        }),
      );
    }
  });
  snapshotItems.forEach((item) => {
    const current = currentById.get(item.id);
    const target =
      current?.data.status === 'CANCELLED'
        ? doc(collection(firestore, collectionPath))
        : doc(firestore, collectionPath, item.id);
    operations.push((batch) =>
      batch.set(
        target,
        restoredMetadata(
          item.data,
          current?.data.status === 'ACTIVE' ? current.data : undefined,
          actorUid,
        ),
      ),
    );
  });
}

function queueImportedAttendanceOverlayRestore({
  operations,
  collectionPath,
  snapshotItems,
  currentItems,
  actorUid,
}: {
  operations: Array<(batch: WriteBatch) => void>;
  collectionPath: string;
  snapshotItems: RecoverySnapshotItem[];
  currentItems: RecoverySnapshotItem[];
  actorUid: string;
}) {
  const { firestore } = requireContext();
  const snapshots = new Map(
    snapshotItems
      .filter((item) => item.data.source === 'attendance_import')
      .map((item) => [item.id, item]),
  );
  currentItems
    .filter((item) => item.data.source === 'attendance_import')
    .forEach((current) => {
      const previous = snapshots.get(current.id);
      if (!previous) return;
      operations.push((batch) =>
        batch.update(doc(firestore, collectionPath, current.id), {
          manual_override: previous.data.manual_override ?? null,
          work_time_correction: previous.data.work_time_correction ?? null,
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        }),
      );
    });
}

function queueReviewRestore({
  operations,
  collectionPath,
  snapshotItems,
  currentItems,
  actorUid,
}: {
  operations: Array<(batch: WriteBatch) => void>;
  collectionPath: string;
  snapshotItems: RecoverySnapshotItem[];
  currentItems: RecoverySnapshotItem[];
  actorUid: string;
}) {
  const { firestore } = requireContext();
  const snapshotIds = new Set(snapshotItems.map((item) => item.id));
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  currentItems.forEach((item) => {
    if (!snapshotIds.has(item.id)) {
      operations.push((batch) =>
        batch.update(doc(firestore, collectionPath, item.id), {
          review_status: 'DRAFT',
          review_note: '',
          reviewed_at: serverTimestamp(),
          reviewed_by: actorUid,
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        }),
      );
    }
  });
  snapshotItems.forEach((item) => {
    const current = currentById.get(item.id);
    operations.push((batch) =>
      batch.set(doc(firestore, collectionPath, item.id), {
        ...restoredMetadata(item.data, current?.data, actorUid),
        reviewed_at: serverTimestamp(),
        reviewed_by: actorUid,
      }),
    );
  });
}

function queueSettlementRestore({
  operations,
  collectionPath,
  snapshotItems,
  currentItems,
}: {
  operations: Array<(batch: WriteBatch) => void>;
  collectionPath: string;
  snapshotItems: RecoverySnapshotItem[];
  currentItems: RecoverySnapshotItem[];
}) {
  const { firestore } = requireContext();
  const snapshotIds = new Set(snapshotItems.map((item) => item.id));
  currentItems.forEach((item) => {
    if (!snapshotIds.has(item.id)) {
      operations.push((batch) =>
        batch.delete(doc(firestore, collectionPath, item.id)),
      );
    }
  });
  snapshotItems.forEach((item) => {
    operations.push((batch) =>
      batch.set(doc(firestore, collectionPath, item.id), {
        ...item.data,
        calculated_at: serverTimestamp(),
      }),
    );
  });
}

function restoredMetadata(
  snapshot: DocumentData,
  current: DocumentData | undefined,
  actorUid: string,
) {
  return {
    ...snapshot,
    created_at: current?.created_at ?? serverTimestamp(),
    created_by: current?.created_by ?? actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  };
}
