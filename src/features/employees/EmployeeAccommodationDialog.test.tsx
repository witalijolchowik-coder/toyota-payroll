import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type {
  Employee,
  EmployeeEntitlement,
  PayrollSetting,
} from '../../types/firestore';
import { pl } from '../../i18n/pl';
import { EmployeeAccommodationDialog } from './EmployeeAccommodationDialog';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test',
};

function employee(): Employee {
  return {
    id: 'employee-1',
    tetaNumber: 'T001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-07-01T00:00:00.000Z'),
    employmentEndDate: null,
    contracts: [
      {
        id: 'contract-1',
        employeeId: 'employee-1',
        tetaNumber: 'T001',
        sequenceId: 'sequence-1',
        startDate: '2026-07-01',
        endDate: '2026-12-31',
        status: 'ACTIVE',
        note: null,
        ...metadata,
      },
    ],
    employmentEndEvents: [],
    ...metadata,
  };
}

function accommodation(): EmployeeEntitlement {
  return {
    id: 'housing-1',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    type: 'COMPANY_ACCOMMODATION',
    accommodationVariantKey: 'premium',
    validFrom: '2026-08-01',
    validTo: null,
    status: 'ACTIVE',
    note: null,
    ...metadata,
  };
}

const variant: PayrollSetting = {
  id: 'premium-setting',
  settingKey: 'accommodation_allowance',
  variantKey: 'premium',
  variantName: 'Premium',
  amount: 500,
  taxType: 'NET',
  validFrom: '2026-01',
  validTo: null,
  active: true,
  description: '',
  ...metadata,
};

describe('EmployeeAccommodationDialog', () => {
  it('defaults the first move-in to employment start and shows derived own housing', async () => {
    const onMoveIn = vi.fn().mockResolvedValue(undefined);
    render(
      <EmployeeAccommodationDialog
        employee={employee()}
        currentAccommodation={null}
        entitlements={[]}
        accommodationVariants={[variant]}
        onClose={vi.fn()}
        onMoveIn={onMoveIn}
        onMoveOut={vi.fn()}
      />,
    );

    const moveInDate = screen.getByRole('textbox', {
      name: new RegExp(pl.employees.accommodation.moveInDate),
    });
    expect(moveInDate).toHaveValue('01.07.2026');
    expect(
      screen.getByRole('table', {
        name: pl.employees.accommodation.history.title,
      }),
    ).toHaveTextContent(pl.employees.accommodation.history.own);

    fireEvent.change(moveInDate, { target: { value: '05.07.2026' } });
    fireEvent.blur(moveInDate);
    fireEvent.click(
      screen.getByRole('button', {
        name: pl.employees.accommodation.confirmMoveIn,
      }),
    );

    await waitFor(() =>
      expect(onMoveIn).toHaveBeenCalledWith(
        expect.objectContaining({
          validFrom: '2026-07-05',
          type: 'COMPANY_ACCOMMODATION',
          accommodationVariantKey: 'premium',
        }),
      ),
    );
  });

  it('shows the company category and earlier own period in the move-out dialog', () => {
    const current = accommodation();
    render(
      <EmployeeAccommodationDialog
        employee={employee()}
        currentAccommodation={current}
        entitlements={[current]}
        accommodationVariants={[variant]}
        onClose={vi.fn()}
        onMoveIn={vi.fn()}
        onMoveOut={vi.fn()}
      />,
    );

    const history = screen.getByRole('table', {
      name: pl.employees.accommodation.history.title,
    });
    expect(history).toHaveTextContent('2026-07-01');
    expect(history).toHaveTextContent(pl.employees.accommodation.history.own);
    expect(history).toHaveTextContent(
      pl.employees.accommodation.history.company,
    );
    expect(history).toHaveTextContent('Premium');
  });
});
