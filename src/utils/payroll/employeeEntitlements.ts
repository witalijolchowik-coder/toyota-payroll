import type {
  Employee,
  EmployeeEntitlement,
  EmployeeEntitlementType,
  IsoDate,
  MonthId,
} from '../../types/firestore';
import { dateToIsoDate, getPayrollMonthDateRange } from './month';

export type EntitlementResolutionWarningCode =
  'housing-entitlement-conflict' | 'company-accommodation-missing-variant';

export interface EmployeeSettlementEntitlements {
  udtEligible?: boolean;
  ownHousingAllowanceEligible?: boolean;
  companyAccommodation?: {
    variantKey?: string | null;
    contractStartDate?: Date | null;
    contractEndDate?: Date | null;
  } | null;
  reviewWarnings?: EntitlementResolutionWarningCode[];
}

export interface EmployeeEntitlementResolution {
  employeeId: string;
  entitlements: EmployeeSettlementEntitlements;
}

interface MonthIsoRange {
  start: IsoDate;
  end: IsoDate;
}

function monthIsoRange(monthId: MonthId): MonthIsoRange {
  const range = getPayrollMonthDateRange(monthId);
  return {
    start: dateToIsoDate(range.start),
    end: dateToIsoDate(range.end),
  };
}

function isoDateToUtcDate(isoDate: IsoDate): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function entitlementEnd(entitlement: EmployeeEntitlement): IsoDate {
  return entitlement.validTo ?? '9999-12-31';
}

export function employeeEntitlementOverlapsRange(
  entitlement: EmployeeEntitlement,
  range: MonthIsoRange,
): boolean {
  return (
    entitlement.validFrom <= range.end &&
    entitlementEnd(entitlement) >= range.start
  );
}

export function employeeEntitlementCoversFullRange(
  entitlement: EmployeeEntitlement,
  range: MonthIsoRange,
): boolean {
  return (
    entitlement.validFrom <= range.start &&
    entitlementEnd(entitlement) >= range.end
  );
}

export function employeeEntitlementsOverlap(
  first: Pick<EmployeeEntitlement, 'validFrom' | 'validTo'>,
  second: Pick<EmployeeEntitlement, 'validFrom' | 'validTo'>,
): boolean {
  return (
    first.validFrom <= (second.validTo ?? '9999-12-31') &&
    (first.validTo ?? '9999-12-31') >= second.validFrom
  );
}

function activeEmployeeEntitlements(
  employee: Employee,
  entitlements: readonly EmployeeEntitlement[],
  type: EmployeeEntitlementType,
): EmployeeEntitlement[] {
  return entitlements
    .filter(
      (entitlement) =>
        entitlement.employeeId === employee.id &&
        entitlement.type === type &&
        entitlement.status === 'ACTIVE',
    )
    .sort((first, second) =>
      first.validFrom === second.validFrom
        ? first.id.localeCompare(second.id)
        : first.validFrom.localeCompare(second.validFrom),
    );
}

export function resolveEmployeeSettlementEntitlements({
  employee,
  monthId,
  entitlements,
}: {
  employee: Employee;
  monthId: MonthId;
  entitlements: readonly EmployeeEntitlement[];
}): EmployeeSettlementEntitlements {
  const range = monthIsoRange(monthId);
  const warnings = new Set<EntitlementResolutionWarningCode>();
  const udtEntitlements = activeEmployeeEntitlements(
    employee,
    entitlements,
    'UDT',
  );
  const ownHousingEntitlements = activeEmployeeEntitlements(
    employee,
    entitlements,
    'OWN_HOUSING_ALLOWANCE',
  );
  const companyAccommodationEntitlements = activeEmployeeEntitlements(
    employee,
    entitlements,
    'COMPANY_ACCOMMODATION',
  );

  const udtEligible = udtEntitlements.some((entitlement) =>
    employeeEntitlementCoversFullRange(entitlement, range),
  );
  const ownHousingAllowanceEligible = ownHousingEntitlements.some(
    (entitlement) => employeeEntitlementCoversFullRange(entitlement, range),
  );
  const companyAccommodation =
    companyAccommodationEntitlements
      .filter((entitlement) =>
        employeeEntitlementOverlapsRange(entitlement, range),
      )
      .at(-1) ?? null;

  const overlappingOwnHousing = ownHousingEntitlements.some((ownHousing) =>
    companyAccommodationEntitlements.some(
      (companyAccommodationEntitlement) =>
        employeeEntitlementsOverlap(
          ownHousing,
          companyAccommodationEntitlement,
        ) &&
        employeeEntitlementOverlapsRange(ownHousing, range) &&
        employeeEntitlementOverlapsRange(
          companyAccommodationEntitlement,
          range,
        ),
    ),
  );

  if (overlappingOwnHousing) {
    warnings.add('housing-entitlement-conflict');
  }
  if (
    companyAccommodation &&
    (!companyAccommodation.accommodationVariantKey ||
      !companyAccommodation.accommodationVariantKey.trim())
  ) {
    warnings.add('company-accommodation-missing-variant');
  }

  return {
    udtEligible,
    ownHousingAllowanceEligible,
    companyAccommodation: companyAccommodation
      ? {
          variantKey: companyAccommodation.accommodationVariantKey,
          contractStartDate: isoDateToUtcDate(companyAccommodation.validFrom),
          contractEndDate: companyAccommodation.validTo
            ? isoDateToUtcDate(companyAccommodation.validTo)
            : null,
        }
      : null,
    reviewWarnings: [...warnings],
  };
}

export function resolveMonthlyEmployeeEntitlements({
  employees,
  monthId,
  entitlements,
}: {
  employees: readonly Employee[];
  monthId: MonthId;
  entitlements: readonly EmployeeEntitlement[];
}): Map<string, EmployeeSettlementEntitlements> {
  return new Map(
    employees.map((employee) => [
      employee.id,
      resolveEmployeeSettlementEntitlements({
        employee,
        monthId,
        entitlements,
      }),
    ]),
  );
}
