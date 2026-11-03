import type {
  Department,
  EmployeeColorShift,
  IsoDate,
} from '../../types/firestore';
import { intervalHours, isValidClockTime } from '../payroll/workTimeDeviations';

export interface BrigadeScheduleDay {
  id: string;
  departmentId: string;
  brigade: EmployeeColorShift;
  employeeId: string | null;
  date: IsoDate;
  kind: 'DAY' | 'NIGHT' | 'DAY_OFF';
  startTime: string | null;
  endTime: string | null;
  plannedHours: number;
  status: 'ACTIVE' | 'CANCELLED';
  note: string | null;
}

export function isBrigadeScheduleEnabled(
  department: Department | null | undefined,
  date: IsoDate,
) {
  return Boolean(
    department?.active &&
    department.brigadeSchedulingFrom &&
    department.brigadeSchedulingFrom <= date,
  );
}

export function validateBrigadeScheduleDay(day: BrigadeScheduleDay): boolean {
  const parsed = new Date(day.date + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== day.date
  )
    return false;
  if (
    !day.departmentId ||
    !['ACTIVE', 'CANCELLED'].includes(day.status) ||
    !['RED', 'WHITE', 'BLUE', 'YELLOW', 'ORANGE'].includes(day.brigade)
  )
    return false;
  if (day.kind === 'DAY_OFF')
    return (
      day.plannedHours === 0 && day.startTime === null && day.endTime === null
    );
  return (
    ['DAY', 'NIGHT'].includes(day.kind) &&
    Boolean(
      day.startTime &&
      day.endTime &&
      day.startTime !== day.endTime &&
      isValidClockTime(day.startTime) &&
      isValidClockTime(day.endTime) &&
      day.plannedHours > 0 &&
      day.plannedHours <= 24 &&
      Math.abs(
        intervalHours({ startTime: day.startTime, endTime: day.endTime }) -
          day.plannedHours,
      ) < 0.001,
    )
  );
}

export function resolveBrigadeScheduleDay(
  days: readonly BrigadeScheduleDay[],
  employeeId: string,
  departmentId: string,
  brigade: EmployeeColorShift | null,
  date: IsoDate,
) {
  const active = days.filter(
    (d) =>
      d.status === 'ACTIVE' &&
      d.departmentId === departmentId &&
      d.date === date,
  );
  return (
    active.find((d) => d.employeeId === employeeId) ??
    active.find((d) => d.employeeId === null && d.brigade === brigade) ??
    null
  );
}
