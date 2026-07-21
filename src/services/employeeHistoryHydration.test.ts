import type {
  Employee,
  EmployeeContract,
  EmploymentEndEvent,
} from '../types/firestore';
import { hydrateEmployeesWithEmploymentHistory } from './employeeHistoryHydration';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test',
};

const employee: Employee = {
  id: 'employee-1',
  tetaNumber: 'T001',
  firstName: 'Jan',
  lastName: 'Kowalski',
  pesel: null,
  passportNumber: null,
  foreignDocumentNumber: null,
  isActive: false,
  departmentId: null,
  shiftAssignment: null,
  employmentStartDate: null,
  employmentEndDate: null,
  ...metadata,
};

const contract: EmployeeContract = {
  id: 'contract-1',
  employeeId: employee.id,
  tetaNumber: employee.tetaNumber,
  sequenceId: 'sequence-1',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'ACTIVE',
  note: null,
  ...metadata,
};

const endEvent: EmploymentEndEvent = {
  id: 'end-1',
  employeeId: employee.id,
  tetaNumber: employee.tetaNumber,
  sequenceId: contract.sequenceId,
  endDate: '2026-06-30',
  status: 'ACTIVE',
  reason: null,
  ...metadata,
};

describe('employee employment-history hydration', () => {
  it('attaches canonical contract history without reading legacy dates', () => {
    const [hydrated] = hydrateEmployeesWithEmploymentHistory(
      [employee],
      [contract],
      [endEvent],
    );

    expect(hydrated?.employmentStartDate).toBeNull();
    expect(hydrated?.employmentEndDate).toBeNull();
    expect(hydrated?.contracts).toEqual([contract]);
    expect(hydrated?.employmentEndEvents).toEqual([endEvent]);
  });

  it('returns explicit empty histories for employees without contract data', () => {
    const [hydrated] = hydrateEmployeesWithEmploymentHistory(
      [employee],
      [],
      [],
    );

    expect(hydrated?.contracts).toEqual([]);
    expect(hydrated?.employmentEndEvents).toEqual([]);
  });
});
