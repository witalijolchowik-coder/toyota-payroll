import type {
  MonthId,
  PayrollSetting,
  PayrollSettingCreateInput,
  PayrollSettingTaxType,
} from '../../types/firestore';
import { parsePayrollMonthId } from './month';

export type PayrollSettingValidationCode =
  | 'required'
  | 'invalid-amount'
  | 'invalid-month'
  | 'invalid-range'
  | 'variant-required';

export interface PayrollSettingValidationErrors {
  settingKey?: PayrollSettingValidationCode;
  variantKey?: PayrollSettingValidationCode;
  variantName?: PayrollSettingValidationCode;
  amount?: PayrollSettingValidationCode;
  validFrom?: PayrollSettingValidationCode;
  validTo?: PayrollSettingValidationCode;
  taxType?: PayrollSettingValidationCode;
}

export class PayrollSettingResolutionError extends Error {
  constructor(
    readonly code: 'duplicate-effective-version',
    readonly settingKey: string,
    readonly monthId: MonthId,
  ) {
    super(`${code}: ${settingKey} for ${monthId}`);
    this.name = 'PayrollSettingResolutionError';
  }
}

function isMonthId(value: string): value is MonthId {
  try {
    parsePayrollMonthId(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizePayrollSettingInput(
  input: PayrollSettingCreateInput,
): PayrollSettingCreateInput {
  return {
    ...input,
    settingKey: input.settingKey.trim().toLocaleLowerCase('en-US'),
    variantKey: input.variantKey
      ? input.variantKey.trim().toLocaleLowerCase('en-US')
      : null,
    variantName: input.variantName?.trim() || null,
    description: input.description.trim(),
    taxType:
      input.taxType ?? defaultPayrollSettingTaxType(input.settingKey.trim()),
  };
}

export function defaultPayrollSettingTaxType(
  settingKey: string,
): PayrollSettingTaxType {
  return settingKey === 'transport_allowance' ||
    settingKey === 'housing_deposit'
    ? 'NET'
    : 'GROSS';
}

export function validatePayrollSettingInput(
  input: PayrollSettingCreateInput,
): PayrollSettingValidationErrors {
  const errors: PayrollSettingValidationErrors = {};
  const normalized = normalizePayrollSettingInput(input);

  if (!normalized.settingKey) {
    errors.settingKey = 'required';
  }
  if (!Number.isFinite(normalized.amount) || normalized.amount < 0) {
    errors.amount = 'invalid-amount';
  }
  if (!normalized.taxType || !['GROSS', 'NET'].includes(normalized.taxType)) {
    errors.taxType = 'required';
  }
  if (!isMonthId(normalized.validFrom)) {
    errors.validFrom = 'invalid-month';
  }
  if (normalized.validTo && !isMonthId(normalized.validTo)) {
    errors.validTo = 'invalid-month';
  } else if (
    normalized.validTo &&
    !errors.validFrom &&
    normalized.validTo < normalized.validFrom
  ) {
    errors.validTo = 'invalid-range';
  }

  if (normalized.settingKey === 'accommodation_allowance') {
    if (!normalized.variantKey) {
      errors.variantKey = 'variant-required';
    }
    if (!normalized.variantName) {
      errors.variantName = 'variant-required';
    }
  }

  return errors;
}

export type PayrollSettingLifecycleStatus =
  'FUTURE' | 'ACTIVE' | 'HISTORICAL' | 'CANCELLED';

export interface PayrollSettingLifecyclePlan {
  identity: string;
  overlaps: PayrollSetting[];
  versionsToShorten: Array<{ setting: PayrollSetting; validTo: MonthId }>;
  affectedMonths: MonthId[];
  requiresConfirmation: boolean;
  blockedReason: 'multiple-overlaps' | null;
}

function previousMonth(monthId: MonthId): MonthId {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` as MonthId;
}

function enumerateMonths(start: MonthId, end: MonthId): MonthId[] {
  const result: MonthId[] = [];
  let cursor = start;
  while (cursor <= end && result.length < 600) {
    result.push(cursor);
    const [year, month] = cursor.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month!, 1));
    cursor =
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` as MonthId;
  }
  return result;
}

export function payrollSettingLifecycleStatus(
  setting: Pick<PayrollSetting, 'active' | 'validFrom' | 'validTo'>,
  currentMonth: MonthId,
): PayrollSettingLifecycleStatus {
  if (!setting.active) return 'CANCELLED';
  if (setting.validFrom > currentMonth) return 'FUTURE';
  if (setting.validTo && setting.validTo < currentMonth) return 'HISTORICAL';
  return 'ACTIVE';
}

export function planPayrollSettingVersion(
  settings: readonly PayrollSetting[],
  input: PayrollSettingCreateInput,
): PayrollSettingLifecyclePlan {
  const normalized = normalizePayrollSettingInput(input);
  const identity = payrollSettingIdentity({
    settingKey: normalized.settingKey,
    variantKey: normalized.variantKey,
  });
  const proposedEnd = normalized.validTo ?? ('9999-12' as MonthId);
  const overlaps = settings.filter(
    (setting) =>
      setting.active &&
      payrollSettingIdentity(setting) === identity &&
      setting.validFrom <= proposedEnd &&
      (setting.validTo ?? '9999-12') >= normalized.validFrom,
  );
  const versionsToShorten = overlaps
    .filter((setting) => setting.validFrom < normalized.validFrom)
    .map((setting) => ({
      setting,
      validTo: previousMonth(normalized.validFrom),
    }));
  const affectedEnd =
    normalized.validTo ??
    overlaps
      .map((setting) => setting.validTo)
      .filter((value): value is MonthId => Boolean(value))
      .sort()
      .at(-1) ??
    normalized.validFrom;
  const blockedReason =
    overlaps.length > 1 ||
    overlaps.some((setting) => setting.validFrom >= normalized.validFrom)
      ? 'multiple-overlaps'
      : null;
  return {
    identity,
    overlaps,
    versionsToShorten,
    affectedMonths: enumerateMonths(normalized.validFrom, affectedEnd),
    requiresConfirmation: overlaps.length > 0,
    blockedReason,
  };
}

export function payrollSettingIdentity(
  setting: Pick<PayrollSetting, 'settingKey' | 'variantKey'>,
): string {
  return `${setting.settingKey}::${setting.variantKey ?? ''}`;
}

export function resolveEffectivePayrollSetting(
  settings: readonly PayrollSetting[],
  settingKey: string,
  monthId: MonthId,
  variantKey: string | null = null,
): PayrollSetting | null {
  parsePayrollMonthId(monthId);
  const normalizedKey = settingKey.trim().toLocaleLowerCase('en-US');
  const normalizedVariant = variantKey
    ? variantKey.trim().toLocaleLowerCase('en-US')
    : null;
  const effective = settings
    .filter(
      (setting) =>
        setting.active &&
        setting.settingKey === normalizedKey &&
        setting.variantKey === normalizedVariant &&
        setting.validFrom <= monthId &&
        (!setting.validTo || setting.validTo >= monthId),
    )
    .sort((first, second) => second.validFrom.localeCompare(first.validFrom));

  if (effective.length < 2) {
    return effective[0] ?? null;
  }
  throw new PayrollSettingResolutionError(
    'duplicate-effective-version',
    normalizedKey,
    monthId,
  );
}
