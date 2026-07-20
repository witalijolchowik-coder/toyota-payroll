import {
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  MonthId,
  PayrollSetting,
  PayrollSettingCreateInput,
  PayrollSettingUpdateInput,
} from '../types/firestore';
import {
  normalizePayrollSettingInput,
  planPayrollSettingVersion,
  payrollSettingIdentity,
  validatePayrollSettingInput,
} from '../utils/payroll';
import {
  mapMonthDocument,
  mapPayrollSettingDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { recordAuditEntry } from './auditService';

export type PayrollSettingsServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'duplicate-version'
  | 'settled-history'
  | 'complex-overlap'
  | 'unsafe-cancellation'
  | 'locked-month';

export class PayrollSettingsServiceError extends Error {
  constructor(readonly code: PayrollSettingsServiceErrorCode) {
    super(code);
    this.name = 'PayrollSettingsServiceError';
  }
}

function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new PayrollSettingsServiceError('firebase-unavailable');
  }
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new PayrollSettingsServiceError('authentication-required');
  }
  return { repositories, uid };
}

export async function loadPayrollSettings(): Promise<PayrollSetting[]> {
  const { repositories } = requireContext();
  const snapshot = await getDocs(
    query(repositories.payrollSettings, orderBy('setting_key')),
  );
  return snapshot.docs.map((document) =>
    mapPayrollSettingDocument(document.id, document.data()),
  );
}

async function latestSettledMonthId(): Promise<MonthId | null> {
  const { repositories } = requireContext();
  const snapshot = await getDocs(repositories.months);
  return (
    snapshot.docs
      .map((document) => mapMonthDocument(document.id, document.data()))
      .filter((month) => month.isSettled)
      .map((month) => month.id)
      .sort()
      .at(-1) ?? null
  );
}

export async function createPayrollSettingVersion(
  input: PayrollSettingCreateInput,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const normalized = normalizePayrollSettingInput(input);
  if (Object.keys(validatePayrollSettingInput(normalized)).length > 0) {
    throw new PayrollSettingsServiceError('invalid-input');
  }

  const [settings, settledThrough] = await Promise.all([
    loadPayrollSettings(),
    latestSettledMonthId(),
  ]);
  if (settledThrough && normalized.validFrom <= settledThrough) {
    throw new PayrollSettingsServiceError('settled-history');
  }

  const identity = payrollSettingIdentity({
    settingKey: normalized.settingKey,
    variantKey: normalized.variantKey,
  });
  if (
    settings.some(
      (setting) =>
        setting.active &&
        payrollSettingIdentity(setting) === identity &&
        setting.validFrom === normalized.validFrom,
    )
  ) {
    throw new PayrollSettingsServiceError('duplicate-version');
  }
  const plan = planPayrollSettingVersion(settings, normalized);
  if (plan.blockedReason) {
    throw new PayrollSettingsServiceError('complex-overlap');
  }
  const reference = doc(repositories.payrollSettings);
  await runTransaction(
    repositories.payrollSettings.firestore,
    async (transaction) => {
      for (const change of plan.versionsToShorten) {
        transaction.update(
          doc(repositories.payrollSettings, change.setting.id),
          {
            valid_to: change.validTo,
            tax_type: change.setting.taxType,
            updated_at: serverTimestamp(),
            updated_by: uid,
          },
        );
      }
      transaction.set(reference, {
        setting_key: normalized.settingKey,
        variant_key: normalized.variantKey,
        variant_name: normalized.variantName,
        amount: normalized.amount,
        threshold_scale: normalized.thresholdScale ?? null,
        tax_type: normalized.taxType!,
        valid_from: normalized.validFrom,
        valid_to: normalized.validTo,
        active: true,
        description: normalized.description,
        created_at: serverTimestamp(),
        created_by: uid,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    },
  );
  await recordAuditEntry({
    entityPath: `payrollSettings/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      operation: 'payroll-setting-version-created',
      setting_key: normalized.settingKey,
      variant_key: normalized.variantKey,
      amount: normalized.amount,
      threshold_scale: normalized.thresholdScale ?? null,
      tax_type: normalized.taxType!,
      valid_from: normalized.validFrom,
      valid_to: normalized.validTo,
      shortened_versions: plan.versionsToShorten.map((change) => ({
        id: change.setting.id,
        old_valid_to: change.setting.validTo,
        new_valid_to: change.validTo,
      })),
    },
  });
  return reference.id;
}

export async function endPayrollSettingVersion(
  setting: PayrollSetting,
  validTo: MonthId,
): Promise<void> {
  const { repositories, uid } = requireContext();
  const settledThrough = await latestSettledMonthId();
  if (
    validTo < setting.validFrom ||
    (settledThrough && validTo < settledThrough)
  ) {
    throw new PayrollSettingsServiceError('settled-history');
  }
  await runTransaction(
    repositories.payrollSettings.firestore,
    async (transaction) => {
      transaction.update(doc(repositories.payrollSettings, setting.id), {
        valid_to: validTo,
        tax_type: setting.taxType,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    },
  );
  await recordAuditEntry({
    entityPath: `payrollSettings/${setting.id}`,
    action: 'update',
    actorUid: uid,
    changes: {
      operation: 'payroll-setting-version-ended',
      old_valid_to: setting.validTo,
      new_valid_to: validTo,
    },
  });
}

export async function cancelFuturePayrollSettingVersion(
  setting: PayrollSetting,
  currentMonth: MonthId,
): Promise<void> {
  const { repositories, uid } = requireContext();
  if (!setting.active || setting.validFrom <= currentMonth) {
    throw new PayrollSettingsServiceError('unsafe-cancellation');
  }
  await runTransaction(
    repositories.payrollSettings.firestore,
    async (transaction) => {
      transaction.update(doc(repositories.payrollSettings, setting.id), {
        active: false,
        tax_type: setting.taxType,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    },
  );
  await recordAuditEntry({
    entityPath: `payrollSettings/${setting.id}`,
    action: 'update',
    actorUid: uid,
    changes: {
      operation: 'payroll-setting-version-cancelled',
      valid_from: setting.validFrom,
    },
  });
}

function monthOverlapsSetting(
  monthId: MonthId,
  setting: Pick<PayrollSetting, 'validFrom' | 'validTo'>,
) {
  return (
    setting.validFrom <= monthId &&
    (!setting.validTo || setting.validTo >= monthId)
  );
}

export interface PayrollSettingEditImpact {
  openMonths: MonthId[];
  lockedMonths: MonthId[];
  overlappingVersionIds: string[];
}

export async function previewPayrollSettingVersionEdit(
  setting: PayrollSetting,
  input: PayrollSettingUpdateInput,
): Promise<PayrollSettingEditImpact> {
  const normalized = normalizePayrollSettingInput(input);
  const [settings, monthsSnapshot] = await Promise.all([
    loadPayrollSettings(),
    getDocs(requireContext().repositories.months),
  ]);
  const identity = payrollSettingIdentity(normalized);
  const overlaps = settings.filter(
    (candidate) =>
      candidate.id !== setting.id &&
      candidate.active &&
      payrollSettingIdentity(candidate) === identity &&
      candidate.validFrom <= (normalized.validTo ?? '9999-12') &&
      (candidate.validTo ?? '9999-12') >= normalized.validFrom,
  );
  const affectedMonths = monthsSnapshot.docs
    .map((document) => mapMonthDocument(document.id, document.data()))
    .filter(
      (month) =>
        monthOverlapsSetting(month.id, setting) ||
        monthOverlapsSetting(month.id, normalized),
    );
  return {
    openMonths: affectedMonths
      .filter((month) => !month.isSettled)
      .map((month) => month.id)
      .sort(),
    lockedMonths: affectedMonths
      .filter((month) => month.isSettled)
      .map((month) => month.id)
      .sort(),
    overlappingVersionIds: overlaps.map((candidate) => candidate.id),
  };
}

export async function updatePayrollSettingVersion(
  setting: PayrollSetting,
  input: PayrollSettingUpdateInput,
): Promise<PayrollSettingEditImpact> {
  const { repositories, uid } = requireContext();
  const normalized = normalizePayrollSettingInput(input);
  if (
    normalized.settingKey !== setting.settingKey ||
    normalized.variantKey !== setting.variantKey ||
    Object.keys(validatePayrollSettingInput(normalized)).length > 0
  ) {
    throw new PayrollSettingsServiceError('invalid-input');
  }
  const impact = await previewPayrollSettingVersionEdit(setting, normalized);
  if (impact.lockedMonths.length > 0) {
    throw new PayrollSettingsServiceError('locked-month');
  }
  if (impact.overlappingVersionIds.length > 0) {
    throw new PayrollSettingsServiceError('complex-overlap');
  }

  const monthsSnapshot = await getDocs(repositories.months);
  const openMonthDocuments = impact.openMonths
    .map((monthId) => ({
      monthId,
      reference: repositories.forMonth(monthId).month,
      snapshot: monthsSnapshot.docs.find((document) => document.id === monthId),
    }))
    .filter((month) => month.snapshot);

  await runTransaction(
    repositories.payrollSettings.firestore,
    async (transaction) => {
      transaction.update(doc(repositories.payrollSettings, setting.id), {
        variant_name: normalized.variantName,
        amount: normalized.amount,
        threshold_scale: normalized.thresholdScale ?? null,
        tax_type: normalized.taxType!,
        valid_from: normalized.validFrom,
        valid_to: normalized.validTo,
        description: normalized.description,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
      for (const month of openMonthDocuments) {
        if (month.snapshot && !month.snapshot.data().is_settled) {
          transaction.update(month.reference, {
            calculation_status: 'queued',
            calculation_input_hash: null,
            updated_at: serverTimestamp(),
            updated_by: uid,
          });
        }
      }
    },
  );
  await recordAuditEntry({
    entityPath: `payrollSettings/${setting.id}`,
    action: 'update',
    actorUid: uid,
    changes: {
      operation: 'payroll-setting-version-edited',
      before: {
        amount: setting.amount,
        threshold_scale: setting.thresholdScale ?? null,
        tax_type: setting.taxType,
        valid_from: setting.validFrom,
        valid_to: setting.validTo,
        description: setting.description,
      },
      after: {
        amount: normalized.amount,
        threshold_scale: normalized.thresholdScale ?? null,
        tax_type: normalized.taxType!,
        valid_from: normalized.validFrom,
        valid_to: normalized.validTo,
        description: normalized.description,
      },
      affected_open_months: impact.openMonths,
      blocked_locked_months: impact.lockedMonths,
      recalculation_result:
        impact.openMonths.length > 0 ? 'queued' : 'not-required',
    },
  });
  return impact;
}
