import type {
  Employee,
  EmployeeEntitlement,
  EmployeeEntitlementType,
  IsoDate,
  MonthId,
} from '../../types/firestore';
import {
  employeeContractsOverlapRange,
  isRangeFullyCoveredByContracts,
  resolveEmploymentLifecyclePeriods,
} from '../employees';
import { dateToIsoDate, getPayrollMonthDateRange } from './month';

export type EntitlementResolutionWarningCode =
  'housing-entitlement-conflict' | 'company-accommodation-missing-variant';

export interface EmployeeSettlementEntitlements {
  udtEligible?: boolean;
  udtCoverage?: 'FULL' | 'PARTIAL' | 'NONE';
  ownHousingAllowanceEligible?: boolean;
  housingEmploymentFullMonth?: boolean;
  housingCoverage?:
    'OWN_FULL' | 'COMPANY' | 'TRANSITION' | 'MISSING' | 'CONFLICT';
  companyAccommodationPeriods?: CompanyAccommodationPeriod[];
  companyAccommodation?: {
    variantKey?: string | null;
    contractStartDate?: Date | null;
    contractEndDate?: Date | null;
    episodeId?: string;
  } | null;
  reviewWarnings?: EntitlementResolutionWarningCode[];
}

export interface CompanyAccommodationPeriod {
  entitlementId: string;
  episodeId: string;
  variantKey: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

export interface EmployeeHousingHistoryPeriod {
  id: string;
  type: 'OWN' | 'COMPANY';
  validFrom: IsoDate;
  validTo: IsoDate | null;
  variantKey: string | null;
  current: boolean;
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

function nextIsoDate(isoDate: IsoDate): IsoDate {
  const date = isoDateToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10) as IsoDate;
}

function previousIsoDate(isoDate: IsoDate): IsoDate {
  const date = isoDateToUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10) as IsoDate;
}

function maxIsoDate(first: IsoDate, second: IsoDate): IsoDate {
  return first > second ? first : second;
}

function minIsoDate(
  first: IsoDate | null,
  second: IsoDate | null,
): IsoDate | null {
  if (!first) return second;
  if (!second) return first;
  return first < second ? first : second;
}

export interface CompanyAccommodationEpisode {
  id: string;
  start: IsoDate;
  end: IsoDate | null;
  entitlements: EmployeeEntitlement[];
}

export function resolveCompanyAccommodationEpisodes(
  entitlements: readonly EmployeeEntitlement[],
): CompanyAccommodationEpisode[] {
  const ordered = entitlements
    .filter(
      (entry) =>
        entry.type === 'COMPANY_ACCOMMODATION' && entry.status === 'ACTIVE',
    )
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const episodes: CompanyAccommodationEpisode[] = [];
  for (const entitlement of ordered) {
    const current = episodes.at(-1);
    const isContinuous =
      current &&
      (current.end === null ||
        entitlement.validFrom <= nextIsoDate(current.end));
    if (isContinuous) {
      current.entitlements.push(entitlement);
      current.end =
        current.end === null || entitlement.validTo === null
          ? null
          : current.end > entitlement.validTo
            ? current.end
            : entitlement.validTo;
      continue;
    }
    episodes.push({
      id: entitlement.id,
      start: entitlement.validFrom,
      end: entitlement.validTo,
      entitlements: [entitlement],
    });
  }
  return episodes;
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

function entitlementsCoverFullRange(
  entitlements: readonly EmployeeEntitlement[],
  range: MonthIsoRange,
): boolean {
  let cursor = range.start;
  for (const entitlement of [...entitlements].sort((first, second) =>
    first.validFrom.localeCompare(second.validFrom),
  )) {
    if (entitlementEnd(entitlement) < cursor) continue;
    if (entitlement.validFrom > cursor) return false;
    if (entitlementEnd(entitlement) >= range.end) return true;
    cursor = nextIsoDate(entitlementEnd(entitlement));
  }
  return false;
}

export function resolveEmployeeHousingHistory({
  employee,
  entitlements,
  today = new Date().toISOString().slice(0, 10) as IsoDate,
}: {
  employee: Employee;
  entitlements: readonly EmployeeEntitlement[];
  today?: IsoDate;
}): EmployeeHousingHistoryPeriod[] {
  const companyAccommodation = activeEmployeeEntitlements(
    employee,
    entitlements,
    'COMPANY_ACCOMMODATION',
  );
  const result: EmployeeHousingHistoryPeriod[] = [];

  resolveEmploymentLifecyclePeriods(employee).forEach((lifecycle) => {
    let ownStart: IsoDate | null = lifecycle.startDate;
    const companyPeriods = companyAccommodation.filter(
      (period) =>
        period.validFrom <= (lifecycle.endDate ?? '9999-12-31') &&
        entitlementEnd(period) >= lifecycle.startDate,
    );

    companyPeriods.forEach((period) => {
      const companyStart = maxIsoDate(period.validFrom, lifecycle.startDate);
      const companyEnd = minIsoDate(period.validTo, lifecycle.endDate);
      if (ownStart && ownStart < companyStart) {
        const ownEnd = previousIsoDate(companyStart);
        result.push({
          id: `own:${lifecycle.sequenceId}:${ownStart}`,
          type: 'OWN',
          validFrom: ownStart,
          validTo: ownEnd,
          variantKey: null,
          current: ownStart <= today && ownEnd >= today,
        });
      }
      result.push({
        id: period.id,
        type: 'COMPANY',
        validFrom: companyStart,
        validTo: companyEnd,
        variantKey: period.accommodationVariantKey,
        current: companyStart <= today && (!companyEnd || companyEnd >= today),
      });
      const nextOwnStart = companyEnd ? nextIsoDate(companyEnd) : null;
      ownStart =
        ownStart && nextOwnStart && ownStart > nextOwnStart
          ? ownStart
          : nextOwnStart;
    });

    if (ownStart && (!lifecycle.endDate || ownStart <= lifecycle.endDate)) {
      result.push({
        id: `own:${lifecycle.sequenceId}:${ownStart}`,
        type: 'OWN',
        validFrom: ownStart,
        validTo: lifecycle.endDate,
        variantKey: null,
        current:
          ownStart <= today &&
          (!lifecycle.endDate || lifecycle.endDate >= today),
      });
    }
  });

  return result.sort((first, second) =>
    first.validFrom === second.validFrom
      ? first.type.localeCompare(second.type)
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
  const udtOverlapsMonth = udtEntitlements.some((entitlement) =>
    employeeEntitlementOverlapsRange(entitlement, range),
  );
  const housingEmploymentFullMonth = isRangeFullyCoveredByContracts(
    employee,
    range.start,
    range.end,
  );
  const housingEmploymentOverlapsMonth = employeeContractsOverlapRange(
    employee,
    range.start,
    range.end,
  );
  const accommodationEpisodes = resolveCompanyAccommodationEpisodes(
    companyAccommodationEntitlements,
  );
  const companyAccommodationPeriods = companyAccommodationEntitlements
    .filter((entitlement) =>
      employeeEntitlementOverlapsRange(entitlement, range),
    )
    .map((entitlement) => {
      const episode = accommodationEpisodes.find((candidate) =>
        candidate.entitlements.some((item) => item.id === entitlement.id),
      );
      return {
        entitlementId: entitlement.id,
        episodeId: episode?.id ?? entitlement.id,
        variantKey: entitlement.accommodationVariantKey,
        validFrom: entitlement.validFrom,
        validTo: entitlement.validTo,
      };
    });
  const companyAccommodationOverlapsMonth =
    companyAccommodationPeriods.length > 0;
  const ownHousingAllowanceEligible =
    housingEmploymentFullMonth && !companyAccommodationOverlapsMonth;
  const companyAccommodation =
    companyAccommodationEntitlements
      .filter((entitlement) =>
        employeeEntitlementOverlapsRange(entitlement, range),
      )
      .at(-1) ?? null;
  const accommodationEpisode = accommodationEpisodes.find((episode) =>
    episode.entitlements.some(
      (entitlement) => entitlement.id === companyAccommodation?.id,
    ),
  );

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
  const overlappingCompanyAccommodation = companyAccommodationEntitlements.some(
    (first, index) =>
      companyAccommodationEntitlements
        .slice(index + 1)
        .some(
          (second) =>
            employeeEntitlementsOverlap(first, second) &&
            employeeEntitlementOverlapsRange(first, range) &&
            employeeEntitlementOverlapsRange(second, range),
        ),
  );

  if (overlappingOwnHousing || overlappingCompanyAccommodation) {
    warnings.add('housing-entitlement-conflict');
  }
  if (
    companyAccommodation &&
    (!companyAccommodation.accommodationVariantKey ||
      !companyAccommodation.accommodationVariantKey.trim())
  ) {
    warnings.add('company-accommodation-missing-variant');
  }

  const companyAccommodationCoversFullMonth = entitlementsCoverFullRange(
    companyAccommodationEntitlements,
    range,
  );
  const housingCoverage =
    overlappingOwnHousing || overlappingCompanyAccommodation
      ? ('CONFLICT' as const)
      : !housingEmploymentOverlapsMonth
        ? ('MISSING' as const)
        : companyAccommodationOverlapsMonth
          ? companyAccommodationCoversFullMonth
            ? ('COMPANY' as const)
            : ('TRANSITION' as const)
          : housingEmploymentFullMonth
            ? ('OWN_FULL' as const)
            : ('TRANSITION' as const);

  return {
    udtEligible,
    udtCoverage: udtEligible ? 'FULL' : udtOverlapsMonth ? 'PARTIAL' : 'NONE',
    ownHousingAllowanceEligible,
    housingEmploymentFullMonth,
    housingCoverage,
    companyAccommodationPeriods,
    companyAccommodation: companyAccommodation
      ? {
          variantKey: companyAccommodation.accommodationVariantKey,
          contractStartDate: accommodationEpisode
            ? isoDateToUtcDate(accommodationEpisode.start)
            : isoDateToUtcDate(companyAccommodation.validFrom),
          contractEndDate: accommodationEpisode?.end
            ? isoDateToUtcDate(accommodationEpisode.end)
            : companyAccommodation.validTo
              ? isoDateToUtcDate(companyAccommodation.validTo)
              : null,
          episodeId: accommodationEpisode?.id ?? companyAccommodation.id,
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
