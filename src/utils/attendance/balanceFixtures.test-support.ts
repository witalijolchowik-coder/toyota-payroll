import type {
  BalanceSourceFactsDocument,
  DailyValue,
  Employee,
} from '../../types/firestore';

export function balanceFacts(
  overrides: Partial<BalanceSourceFactsDocument> = {},
): BalanceSourceFactsDocument {
  return {
    version: 1,
    import_id: `balance-${'a'.repeat(64)}`,
    worksheet: 'Synthetic employee',
    row: 10,
    planned_start_time: '06:00',
    planned_end_time: '14:00',
    actual_start_time: '06:00',
    actual_end_time: '14:00',
    planned_hours: 8,
    credited_hours: 8,
    extra_hours: 0,
    night_hours: 0,
    presence_hours: 8,
    absence_hours: 0,
    private_time_hours: 0,
    private_time_repaid_hours: 0,
    private_time_balance_hours: 0,
    client_overtime_50_hours: 0,
    client_overtime_100_hours: 0,
    client_time_off_hours: 0,
    client_time_off_due_hours: 0,
    client_day_off: 0,
    client_day_off_due: 0,
    ...overrides,
  };
}
const now = new Date('2026-10-01T00:00:00Z');
export function balanceEmployee(endDate: string | null = null): Employee {
  return {
    id: 'employee-1',
    tetaNumber: 'TETA-1001',
    firstName: 'Jan',
    lastName: 'Testowy',
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-09-01T00:00:00Z'),
    employmentEndDate: endDate ? new Date(`${endDate}T00:00:00Z`) : null,
    employmentEndEvents: endDate
      ? [
          {
            id: 'end-1',
            employeeId: 'employee-1',
            tetaNumber: 'TETA-1001',
            sequenceId: 'sequence-1',
            endDate,
            status: 'ACTIVE',
            reason: 'Synthetic termination',
            createdAt: now,
            createdBy: 'test',
            updatedAt: now,
            updatedBy: 'test',
          },
        ]
      : [],
    contracts: [
      {
        id: 'contract-1',
        employeeId: 'employee-1',
        tetaNumber: 'TETA-1001',
        sequenceId: 'sequence-1',
        startDate: '2026-09-01',
        endDate,
        status: 'ACTIVE',
        note: null,
        createdAt: now,
        createdBy: 'test',
        updatedAt: now,
        updatedBy: 'test',
      },
    ],
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
export function balanceDaily(
  date = '2026-09-10',
  facts = balanceFacts(),
): DailyValue {
  return {
    id: `employee-1_${date}`,
    monthId: '2026-09',
    employeeId: 'employee-1',
    tetaNumber: 'TETA-1001',
    date,
    hours: facts.credited_hours,
    source: 'attendance_import',
    importId: facts.import_id,
    note: null,
    manualOverride: null,
    workTimeCorrection: null,
    balanceSourceFacts: facts,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
