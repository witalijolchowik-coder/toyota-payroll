import {
  addDoc,
  getDocs,
  orderBy,
  query,
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
  payrollSettingIdentity,
  validatePayrollSettingInput,
} from '../utils/payroll';
import {
  mapMonthDocument,
  mapPayrollSettingDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type PayrollSettingsServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'duplicate-version'
  | 'settled-history';

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

  const reference = await addDoc(repositories.payrollSettings, {
    setting_key: normalized.settingKey,
    variant_key: normalized.variantKey,
    variant_name: normalized.variantName,
    amount: normalized.amount,
    valid_from: normalized.validFrom,
    valid_to: normalized.validTo,
    active: true,
    description: normalized.description,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  return reference.id;
}
