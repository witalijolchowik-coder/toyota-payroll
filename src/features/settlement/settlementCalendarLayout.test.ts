import type { Department, Employee } from '../../types/firestore';
import { buildCalendarEmployeeRows } from './settlementCalendarLayout';

const metadata = {
  createdAt: new Date(0),
  createdBy: 'test',
  updatedAt: new Date(0),
  updatedBy: 'test',
};

function employee(
  id: string,
  lastName: string,
  departmentId: string | null,
): Employee {
  return {
    id,
    tetaNumber: id,
    firstName: 'Jan',
    lastName,
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId,
    shiftAssignment: 'RED',
    employmentStartDate: new Date('2026-01-01T00:00:00Z'),
    employmentEndDate: null,
    ...metadata,
  };
}

function department(id: string, name: string): Department {
  return { id, name, shiftMode: 'THREE_SHIFT', active: true, ...metadata };
}

describe('settlement calendar employee layout', () => {
  it('uses canonical department order, surname order and final unassigned group', () => {
    const result = buildCalendarEmployeeRows({
      employees: [
        employee('4', 'Bez Działu', null),
        employee('3', 'Nowak', 'szwalnia'),
        employee('2', 'Żak', 'metal'),
        employee('1', 'Adamski', 'metal'),
      ],
      departments: [
        department('szwalnia', 'Szwalnia'),
        department('metal', 'Metal'),
      ],
      assignments: [],
      referenceDate: '2026-06-01',
      unassignedLabel: 'Brak przypisanego działu',
    });

    expect(result.map((row) => row.employee.id)).toEqual(['1', '2', '3', '4']);
    expect(result.map((row) => row.isFirstInDepartment)).toEqual([
      true,
      false,
      true,
      true,
    ]);
  });
});
