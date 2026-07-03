import type {
  MonthId,
  PayrollSetting,
  PayrollSettingCreateInput,
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
  };
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
  if (effective[0]!.validFrom === effective[1]!.validFrom) {
    throw new PayrollSettingResolutionError(
      'duplicate-effective-version',
      normalizedKey,
      monthId,
    );
  }
  return effective[0]!;
}
