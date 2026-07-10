import type { EmployeeEntitlementCreateInput } from '../../types/firestore';
import { validateEmployeeEntitlementInput } from './employeeEntitlementValidation';

const baseInput: EmployeeEntitlementCreateInput = {
  employeeId: 'employee-1',
  tetaNumber: 'T001',
  type: 'UDT',
  accommodationVariantKey: null,
  validFrom: '2026-06-01',
  validTo: null,
  note: null,
};

describe('employee entitlement validation', () => {
  it('requires a company accommodation variant', () => {
    expect(
      validateEmployeeEntitlementInput({
        ...baseInput,
        type: 'COMPANY_ACCOMMODATION',
      }),
    ).toContain('variant-required');
  });

  it('rejects invalid date range', () => {
    expect(
      validateEmployeeEntitlementInput({
        ...baseInput,
        validTo: '2026-05-31',
      }),
    ).toContain('invalid-date-range');
  });

  it('warns about own housing and company accommodation overlap', () => {
    expect(
      validateEmployeeEntitlementInput(
        {
          ...baseInput,
          type: 'OWN_HOUSING_ALLOWANCE',
          validFrom: '2026-06-01',
          validTo: '2026-06-30',
        },
        [
          {
            id: 'company',
            employeeId: 'employee-1',
            tetaNumber: 'T001',
            type: 'COMPANY_ACCOMMODATION',
            accommodationVariantKey: 'type-a',
            validFrom: '2026-06-15',
            validTo: null,
            status: 'ACTIVE',
            note: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            createdBy: 'test',
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedBy: 'test',
          },
        ],
      ),
    ).toContain('housing-conflict');
  });
});
