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
  | 'unsafe-cancellation';

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
