import { describe, expect, it } from 'vitest';

import type { Employee } from '../../types/firestore';
import {
  buildDepartmentAssignmentReconciliation,
  DMYTRO_KARPETS_TETA,
  isApplicableDepartmentAssignmentRow,
  parseBalanceTetaMatrix,
  parseDepartmentAssignmentMatrix,
} from './departmentAssignmentImport';

describe('canonical department assignment reconciliation', () => {
  it('parses the live-shaped assignment and balance sheets', () => {
    expect(
      parseDepartmentAssignmentMatrix([
        ['nazwisko i imię', 'Firma', 'Nazwa MPK'],
        ['KARPETS DMYTRO', 'PS', 'MFG Toyota Metal 936B'],
      ]),
    ).toEqual([
      {
        rowNumber: 2,
        employeeName: 'KARPETS DMYTRO',
        departmentName: 'MFG Toyota Metal 936B',
      },
    ]);
    expect(
      parseBalanceTetaMatrix([
        ['Raport'],
        ['Nr TETA', 'Nazwisko', 'Imie'],
        ['WT-1', 'Kowalski', 'Jan'],
      ]),
    ).toEqual([
      {
        rowNumber: 3,
        tetaNumber: 'WT-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
      },
    ]);
  });

  it('matches by normalized name order and prefers the resolved TETA identity', () => {
    const reconciliation = buildDepartmentAssignmentReconciliation({
      assignmentRows: [row(2, 'Jan Kowalski', 'MFG Toyota Metal 402B')],
      balanceRows: [balance(7, 'WT-100', 'JAN', 'KOWALSKI')],
      existingEmployees: [
        employee('existing', 'WT-100', 'Jan', 'Kowalski', 'metal'),
      ],
    });

    expect(reconciliation.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'existing-changed',
          employee: expect.objectContaining({ id: 'existing' }),
          targetDepartmentId: 'metal-402b',
        }),
      ]),
    );
  });

  it('ignores identical duplicate rows and blocks conflicting assignments', () => {
    const duplicate = buildDepartmentAssignmentReconciliation({
      assignmentRows: [
        row(2, 'Anna Nowak', 'MFG Toyota Cover'),
        row(3, 'ANNA   NOWAK', 'Szwalnia Toyota'),
      ],
      balanceRows: [balance(7, 'WT-101', 'Anna', 'Nowak')],
      existingEmployees: [],
    });
    expect(duplicate.counts['duplicate-source-row-ignored']).toBe(1);
    expect(duplicate.counts['new-employee']).toBe(1);

    const conflict = buildDepartmentAssignmentReconciliation({
      assignmentRows: [
        row(2, 'Anna Nowak', 'Metal 402B'),
        row(3, 'Anna Nowak', 'Metal 936B'),
      ],
      balanceRows: [balance(7, 'WT-101', 'Anna', 'Nowak')],
      existingEmployees: [],
    });
    expect(conflict.counts['conflicting-department']).toBe(1);
    expect(
      conflict.rows.filter(isApplicableDepartmentAssignmentRow),
    ).toHaveLength(0);
  });

  it('reports unresolved TETA and never guesses a generic legacy Metal', () => {
    const reconciliation = buildDepartmentAssignmentReconciliation({
      assignmentRows: [row(2, 'Nieznana Osoba', 'Metal 402B')],
      balanceRows: [],
      existingEmployees: [employee('legacy', 'WT-9', 'Inna', 'Osoba', 'Metal')],
    });
    expect(reconciliation.counts['unresolved-teta']).toBe(1);
    expect(reconciliation.counts['ambiguous-legacy-metal']).toBe(1);
  });

  it('applies all special employee rules without counting Vitalii Olkhovyk', () => {
    const reconciliation = buildDepartmentAssignmentReconciliation({
      assignmentRows: [
        row(2, 'KARPETS DMYTRO', 'MFG Toyota Metal 936B'),
        row(3, 'OLKHOVYK VITALII', 'MFG Toyota Metal 402B'),
      ],
      balanceRows: [
        balance(7, 'WT-07832607', 'MAREK', 'MAŚLANY'),
        balance(8, 'WT-07832608', 'ROBERT', 'WOJTALUK'),
        balance(9, '42-00000171', 'VITALII', 'OLKHOVYK'),
      ],
      existingEmployees: [
        employee('dmytro', DMYTRO_KARPETS_TETA, 'Dmytro', 'Karpets', 'metal'),
      ],
    });

    expect(reconciliation.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tetaNumber: DMYTRO_KARPETS_TETA,
          targetDepartmentId: 'metal-936b',
          employee: expect.objectContaining({ id: 'dmytro' }),
        }),
        expect.objectContaining({
          tetaNumber: 'WT-07832607',
          targetDepartmentId: 'headliner-bmw',
          status: 'new-employee',
        }),
        expect.objectContaining({
          tetaNumber: 'WT-07832608',
          targetDepartmentId: 'headliner-bmw',
          status: 'new-employee',
        }),
        expect.objectContaining({
          tetaNumber: '42-00000171',
          status: 'excluded-non-worker',
        }),
      ]),
    );
    expect(
      reconciliation.rows.some(
        (item) =>
          item.tetaNumber === '42-00000171' &&
          isApplicableDepartmentAssignmentRow(item),
      ),
    ).toBe(false);
  });

  it('creates an incomplete employee preview without fabricating contract data', () => {
    const reconciliation = buildDepartmentAssignmentReconciliation({
      assignmentRows: [row(2, 'NOWAK ANNA', 'PU Toyota')],
      balanceRows: [balance(7, 'WT-200', 'Anna', 'Nowak')],
      existingEmployees: [],
    });
    const candidate = reconciliation.rows.find(
      (item) => item.status === 'new-employee',
    );
    expect(candidate).toMatchObject({
      tetaNumber: 'WT-200',
      firstName: 'Anna',
      lastName: 'Nowak',
      targetDepartmentId: 'pu-toyota',
      employee: null,
    });
  });
});

function row(rowNumber: number, employeeName: string, departmentName: string) {
  return { rowNumber, employeeName, departmentName };
}

function balance(
  rowNumber: number,
  tetaNumber: string,
  firstName: string,
  lastName: string,
) {
  return { rowNumber, tetaNumber, firstName, lastName };
}

function employee(
  id: string,
  tetaNumber: string,
  firstName: string,
  lastName: string,
  departmentId: string,
): Employee {
  const now = new Date('2026-07-01T00:00:00.000Z');
  return {
    id,
    tetaNumber,
    firstName,
    lastName,
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    phoneNumber: null,
    citizenship: null,
    gender: null,
    firstToyotaEmploymentDate: null,
    medicalExaminationDate: null,
    medicalValidUntil: null,
    medicalExaminationType: null,
    isActive: true,
    departmentId,
    shiftAssignment: null,
    employmentStartDate: null,
    employmentEndDate: null,
    contracts: [],
    employmentEndEvents: [],
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
