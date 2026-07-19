import type {
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
} from '../../types/firestore';
import { isCanonicalExactDate } from '../../utils/forms/exactDateTimeInput';
import { employeeEntitlementsOverlap } from '../../utils/payroll';

export type EmployeeEntitlementValidationError =
  | 'employee-required'
  | 'variant-required'
  | 'date-required'
  | 'invalid-date-range'
  | 'housing-conflict';

export function validateEmployeeEntitlementInput(
  input: EmployeeEntitlementCreateInput,
  existingEntitlements: readonly EmployeeEntitlement[] = [],
): EmployeeEntitlementValidationError[] {
  const errors = new Set<EmployeeEntitlementValidationError>();
  if (!input.employeeId || !input.tetaNumber.trim()) {
    errors.add('employee-required');
  }
  if (!isCanonicalExactDate(input.validFrom)) {
    errors.add('date-required');
  }
  if (
    input.validTo &&
    (!isCanonicalExactDate(input.validTo) || input.validTo < input.validFrom)
  ) {
    errors.add('invalid-date-range');
  }
  if (
    input.type === 'COMPANY_ACCOMMODATION' &&
    !input.accommodationVariantKey?.trim()
  ) {
    errors.add('variant-required');
  }
  if (
    input.employeeId &&
    (input.type === 'COMPANY_ACCOMMODATION' ||
      input.type === 'OWN_HOUSING_ALLOWANCE') &&
    existingEntitlements.some(
      (entitlement) =>
        entitlement.employeeId === input.employeeId &&
        entitlement.status === 'ACTIVE' &&
        ((input.type === 'COMPANY_ACCOMMODATION' &&
          entitlement.type === 'OWN_HOUSING_ALLOWANCE') ||
          (input.type === 'OWN_HOUSING_ALLOWANCE' &&
            entitlement.type === 'COMPANY_ACCOMMODATION')) &&
        employeeEntitlementsOverlap(
          {
            validFrom: input.validFrom,
            validTo: input.validTo,
          },
          entitlement,
        ),
    )
  ) {
    errors.add('housing-conflict');
  }

  return [...errors];
}
