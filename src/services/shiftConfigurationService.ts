import {
  addDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  DepartmentShiftCorrection,
  DepartmentShiftCorrectionCreateInput,
  ShiftHoursVersion,
  ShiftHoursVersionCreateInput,
} from '../types/firestore';
import {
  validateDepartmentShiftCorrection,
  validateShiftHours,
  type ShiftCorrectionImpactSummary,
} from '../utils/schedule';
import { appendAuditEntryToBatch, recordAuditEntry } from './auditService';
import {
  mapDepartmentShiftCorrectionDocument,
  mapShiftHoursVersionDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type ShiftConfigurationServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'duplicate-correction';

export class ShiftConfigurationServiceError extends Error {
  constructor(readonly code: ShiftConfigurationServiceErrorCode) {
    super(code);
    this.name = 'ShiftConfigurationServiceError';
  }
}

async function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories || !auth) {
    throw new ShiftConfigurationServiceError('firebase-unavailable');
  }
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new ShiftConfigurationServiceError('authentication-required');
  }
  return { repositories, uid };
}

export async function loadShiftHoursVersions(): Promise<ShiftHoursVersion[]> {
  const { repositories } = await requireContext();
  const snapshot = await getDocs(repositories.shiftHoursVersions);
  return snapshot.docs
    .map((document) =>
      mapShiftHoursVersionDocument(document.id, document.data()),
    )
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}

export async function loadDepartmentShiftCorrections(): Promise<
  DepartmentShiftCorrection[]
> {
  const { repositories } = await requireContext();
  const snapshot = await getDocs(repositories.departmentShiftCorrections);
  return snapshot.docs
    .map((document) =>
      mapDepartmentShiftCorrectionDocument(document.id, document.data()),
    )
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

export async function createShiftHoursVersion(
  input: ShiftHoursVersionCreateInput,
): Promise<string> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom) ||
    !validateShiftHours(input.intervals)
  ) {
    throw new ShiftConfigurationServiceError('invalid-input');
  }
  const { repositories, uid } = await requireContext();
  const reference = await addDoc(repositories.shiftHoursVersions, {
    valid_from: input.validFrom,
    intervals: Object.fromEntries(
      Object.entries(input.intervals).map(([shift, interval]) => [
        shift,
        { start_time: interval.startTime, end_time: interval.endTime },
      ]),
    ) as never,
    active: true,
    note: input.note,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  await recordAuditEntry({
    entityPath: `shiftHoursVersions/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: { valid_from: input.validFrom, intervals: input.intervals },
  });
  return reference.id;
}

export async function createDepartmentShiftCorrection(
  input: DepartmentShiftCorrectionCreateInput,
  impact?: ShiftCorrectionImpactSummary,
): Promise<string> {
  const validation = validateDepartmentShiftCorrection({
    shiftMode: input.shiftMode,
    groupAssignments: input.groupAssignments,
  });
  if (!validation.valid || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    throw new ShiftConfigurationServiceError('invalid-input');
  }
  const { repositories, uid } = await requireContext();
  const existing = await loadDepartmentShiftCorrections();
  if (
    existing.some(
      (correction) =>
        correction.status === 'ACTIVE' &&
        correction.departmentId === input.departmentId &&
        correction.effectiveDate === input.effectiveDate,
    )
  ) {
    throw new ShiftConfigurationServiceError('duplicate-correction');
  }
  const reference = doc(repositories.departmentShiftCorrections);
  const batch = writeBatch(repositories.departmentShiftCorrections.firestore);
  batch.set(reference, {
    department_id: input.departmentId,
    effective_date: input.effectiveDate,
    shift_mode: input.shiftMode,
    group_assignments: input.groupAssignments,
    status: 'ACTIVE',
    note: input.note,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  const previousCorrection = impact?.previousCorrectionId
    ? existing.find(
        (correction) => correction.id === impact.previousCorrectionId,
      )
    : null;
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `departmentShiftCorrections/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      correction_id: reference.id,
      department_id: input.departmentId,
      effective_date: input.effectiveDate,
      shift_mode: input.shiftMode,
      group_assignments: input.groupAssignments,
      previous_mapping: previousCorrection
        ? {
            shift_mode: previousCorrection.shiftMode,
            group_assignments: previousCorrection.groupAssignments,
          }
        : null,
      new_mapping: {
        shift_mode: input.shiftMode,
        group_assignments: input.groupAssignments,
      },
      impact: impact
        ? {
            range_start: impact.rangeStart,
            range_end: impact.rangeEnd,
            affected_employees: impact.employeeCount,
            changed_plan_days: impact.changedPlanDayCount,
            manual_actual_days: impact.manualActualCount,
            overtime_days: impact.overtimeCount,
            shortage_private_time_days: impact.shortageOrPrivateTimeCount,
            absence_days: impact.absenceCount,
            confirmed_l4_days: impact.confirmedL4Count,
            review_required_days: impact.reviewRequiredCount,
          }
        : null,
    },
  });
  await batch.commit();
  return reference.id;
}

export async function cancelDepartmentShiftCorrection(
  correction: DepartmentShiftCorrection,
): Promise<void> {
  const { repositories, uid } = await requireContext();
  const document = doc(repositories.departmentShiftCorrections, correction.id);
  await updateDoc(document, {
    status: 'CANCELLED',
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  await recordAuditEntry({
    entityPath: `departmentShiftCorrections/${correction.id}`,
    action: 'update',
    actorUid: uid,
    changes: {
      department_id: correction.departmentId,
      effective_date: correction.effectiveDate,
      previous_status: correction.status,
      new_status: 'CANCELLED',
    },
  });
}
