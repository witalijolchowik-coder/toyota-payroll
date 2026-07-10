import type { Employee, EmployeeEntitlement } from '../../types/firestore';
import {
  employeeEntitlementCoversFullRange,
  employeeEntitlementsOverlap,
  resolveEmployeeSettlementEntitlements,
} from './employeeEntitlements';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    tetaNumber: 'T001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: utcDate('2026-01-01'),
    employmentEndDate: null,
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function entitlement(
  overrides: Partial<EmployeeEntitlement> = {},
): EmployeeEntitlement {
  return {
    id: 'entitlement-1',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    type: 'UDT',
    accommodationVariantKey: null,
    validFrom: '2026-01-01',
    validTo: null,
    status: 'ACTIVE',
    note: null,
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

describe('employee entitlement resolver', () => {
  it('recognizes full-month UDT entitlement and ignores partial entitlement', () => {
    const target = employee();

    expect(
      resolveEmployeeSettlementEntitlements({
        employee: target,
        monthId: '2026-06',
        entitlements: [entitlement()],
      }).udtEligible,
    ).toBe(true);

    expect(
      resolveEmployeeSettlementEntitlements({
        employee: target,
        monthId: '2026-06',
        entitlements: [entitlement({ validFrom: '2026-06-02' })],
      }).udtEligible,
    ).toBe(false);
  });

  it('recognizes full-month own housing allowance entitlement', () => {
    const result = resolveEmployeeSettlementEntitlements({
      employee: employee(),
      monthId: '2026-06',
      entitlements: [
        entitlement({
          type: 'OWN_HOUSING_ALLOWANCE',
          validFrom: '2026-06-01',
          validTo: '2026-06-30',
        }),
      ],
    });

    expect(result.ownHousingAllowanceEligible).toBe(true);
  });

  it('resolves company accommodation assignment overlapping the month', () => {
    const result = resolveEmployeeSettlementEntitlements({
      employee: employee(),
      monthId: '2026-06',
      entitlements: [
        entitlement({
          type: 'COMPANY_ACCOMMODATION',
          accommodationVariantKey: 'type-a',
          validFrom: '2026-06-16',
          validTo: '2026-06-30',
        }),
      ],
    });

    expect(result.companyAccommodation).toMatchObject({
      variantKey: 'type-a',
      contractStartDate: utcDate('2026-06-16'),
      contractEndDate: utcDate('2026-06-30'),
    });
  });

  it('ignores cancelled entitlements', () => {
    const result = resolveEmployeeSettlementEntitlements({
      employee: employee(),
      monthId: '2026-06',
      entitlements: [entitlement({ status: 'CANCELLED' })],
    });

    expect(result.udtEligible).toBe(false);
  });

  it('warns when own housing and company accommodation overlap', () => {
    const result = resolveEmployeeSettlementEntitlements({
      employee: employee(),
      monthId: '2026-06',
      entitlements: [
        entitlement({
          type: 'OWN_HOUSING_ALLOWANCE',
          validFrom: '2026-06-01',
          validTo: '2026-06-30',
        }),
        entitlement({
          id: 'company',
          type: 'COMPANY_ACCOMMODATION',
          accommodationVariantKey: 'type-a',
          validFrom: '2026-06-15',
          validTo: null,
        }),
      ],
    });

    expect(result.reviewWarnings).toContain('housing-entitlement-conflict');
  });

  it('keeps effective-dated overlap helpers inclusive', () => {
    expect(
      employeeEntitlementCoversFullRange(entitlement(), {
        start: '2026-06-01',
        end: '2026-06-30',
      }),
    ).toBe(true);
    expect(
      employeeEntitlementsOverlap(
        { validFrom: '2026-06-01', validTo: '2026-06-15' },
        { validFrom: '2026-06-15', validTo: '2026-06-30' },
      ),
    ).toBe(true);
  });
});
