import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';

import { pl } from '../../i18n/pl';
import {
  EmployeeContractServiceError,
  type EmployeeContractState,
} from '../../services/employeeContractsService';
import type { Employee, EmployeeContract } from '../../types/firestore';
import { employeeContractHistoryRevision } from '../../utils/employees';
import {
  contractErrorMessage,
  EmployeeContractsDialog,
} from './EmployeeContractsDialog';

const metadata = {
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  createdBy: 'admin',
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedBy: 'admin',
};

function contract(
  id: string,
  startDate: string,
  endDate: string | null,
  status: EmployeeContract['status'] = 'ACTIVE',
): EmployeeContract {
  return {
    id,
    employeeId: 'employee-1',
    tetaNumber: 'WT-1',
    sequenceId: 'legacy-sequence',
    startDate,
    endDate,
    status,
    note: null,
    ...metadata,
  };
}

function employee(contracts: EmployeeContract[]): Employee {
  return {
    id: 'employee-1',
    tetaNumber: 'WT-1',
    firstName: 'DMYTRO',
    lastName: 'KARPETS',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    departmentId: null,
    shiftAssignment: null,
    contracts,
    employmentEndEvents: [],
    employmentStartDate: null,
    employmentEndDate: null,
    isActive: true,
    ...metadata,
  };
}

type DialogProps = ComponentProps<typeof EmployeeContractsDialog>;

function state(value: Employee): EmployeeContractState {
  return {
    employee: value,
    revision: employeeContractHistoryRevision(value),
  };
}

function renderDialog(options: {
  initial: Employee;
  onReload: ReturnType<typeof vi.fn>;
  onCreate?: ReturnType<typeof vi.fn>;
  onUpdate?: ReturnType<typeof vi.fn>;
  onCancelContract?: ReturnType<typeof vi.fn>;
}) {
  const onCreate = options.onCreate ?? vi.fn(async () => undefined);
  const onUpdate = options.onUpdate ?? vi.fn(async () => undefined);
  const onCancelContract =
    options.onCancelContract ?? vi.fn(async () => undefined);
  render(
    <EmployeeContractsDialog
      employee={options.initial}
      onClose={vi.fn()}
      onReload={options.onReload as DialogProps['onReload']}
      onCreate={onCreate as DialogProps['onCreate']}
      onUpdate={onUpdate as DialogProps['onUpdate']}
      onCancelContract={onCancelContract as DialogProps['onCancelContract']}
      onPreviewUpdate={vi.fn(async () => ({
        openMonths: [],
        lockedMonths: [],
      }))}
      onPreviewCancellation={vi.fn(async () => ({
        openMonths: [],
        lockedMonths: [],
      }))}
      onEndEmployment={vi.fn(async () => undefined)}
      onBootstrapLegacy={vi.fn(async () => undefined)}
    />,
  );
  return { onCreate, onUpdate, onCancelContract };
}

describe('EmployeeContractsDialog canonical contract session', () => {
  it('edits an open-ended legacy contract and adds its continuation without reopening', async () => {
    const openEnded = employee([contract('legacy', '2026-04-24', null)]);
    const edited = employee([contract('legacy', '2026-04-24', '2026-05-31')]);
    const continued = employee([
      contract('legacy', '2026-04-24', '2026-05-31'),
      contract('next', '2026-06-01', '2026-08-31'),
    ]);
    const onReload = vi
      .fn()
      .mockResolvedValueOnce(state(openEnded))
      .mockResolvedValueOnce(state(edited))
      .mockResolvedValueOnce(state(continued));
    const { onCreate, onUpdate } = renderDialog({
      initial: openEnded,
      onReload,
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edytuj umowę' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edytuj umowę' }));
    fireEvent.change(screen.getByLabelText('Data do'), {
      target: { value: '2026-05-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz umowę' }));
    await waitFor(() =>
      expect(screen.getByText('Wpływ korekty umowy')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz umowę' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0]?.[3]).toBe(state(openEnded).revision);
    await waitFor(() =>
      expect(
        screen.getByText('Umowa zakończona — brak decyzji.'),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Dodaj kolejną umowę' }),
    );
    expect(screen.getByLabelText('Data od')).toHaveValue('2026-06-01');
    fireEvent.change(screen.getByLabelText('Data do'), {
      target: { value: '2026-08-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz umowę' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0]?.[2]).toBe(state(edited).revision);
    await waitFor(() =>
      expect(screen.getByText('2026-08-31')).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Ciągłość zatrudnienia')).toHaveLength(2);
    expect(
      screen.queryByText('Umowa zakończona — brak decyzji.'),
    ).not.toBeInTheDocument();
  });

  it('refreshes after a genuine concurrent change and shows a Polish conflict', async () => {
    const current = employee([contract('legacy', '2026-04-24', '2026-05-31')]);
    const changedElsewhere = employee([
      contract('legacy', '2026-04-24', '2026-05-31'),
      contract('external', '2026-06-01', '2026-07-31'),
    ]);
    const onReload = vi
      .fn()
      .mockResolvedValueOnce(state(current))
      .mockResolvedValueOnce(state(changedElsewhere));
    const onCreate = vi.fn(async () => {
      throw new EmployeeContractServiceError('mutation-conflict');
    });
    renderDialog({ initial: current, onReload, onCreate });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Dodaj kolejną umowę' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Dodaj kolejną umowę' }),
    );
    fireEvent.change(screen.getByLabelText('Data do'), {
      target: { value: '2026-08-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz umowę' }));

    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText(
        'Historia umów została zmieniona w innym miejscu. Dane odświeżono — sprawdź je i ponów operację.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('2026-07-31')).toBeInTheDocument();
  });

  it('blocks a rapid second mutation until the first write and refresh finish', async () => {
    const current = employee([contract('legacy', '2026-04-24', '2026-05-31')]);
    const continued = employee([
      contract('legacy', '2026-04-24', '2026-05-31'),
      contract('next', '2026-06-01', '2026-08-31'),
    ]);
    let finishCreate: (() => void) | undefined;
    const createPending = new Promise<void>((resolve) => {
      finishCreate = resolve;
    });
    const onReload = vi
      .fn()
      .mockResolvedValueOnce(state(current))
      .mockResolvedValueOnce(state(continued));
    const onCreate = vi.fn(() => createPending);
    renderDialog({ initial: current, onReload, onCreate });

    const addButton = await screen.findByRole('button', {
      name: 'Dodaj kolejną umowę',
    });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);
    fireEvent.change(screen.getByLabelText('Data do'), {
      target: { value: '2026-08-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz umowę' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(addButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zapisz umowę' })).toBeDisabled();

    finishCreate?.();
    await waitFor(() =>
      expect(screen.getByText('2026-08-31')).toBeInTheDocument(),
    );
  });

  it('never exposes internal contract error codes', () => {
    const cases = [
      'overlapping-contract',
      'duplicate-contract',
      'invalid-contract',
    ] as const;
    cases.forEach((code) => {
      const message = contractErrorMessage(
        new EmployeeContractServiceError(code),
        pl,
      );
      expect(message).not.toContain(code);
    });
  });
});
