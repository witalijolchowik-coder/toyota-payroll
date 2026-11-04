import type { EmployeeColorShift } from '../../types/firestore';
import type { BrigadeDayOffCode, BrigadeScheduleDay } from './brigadeSchedule';

type Code = BrigadeDayOffCode | 'I' | 'II' | 'III' | 'DAY12' | 'NIGHT12';

const calendars = {
  ORANGE:
    'WR WR NIGHT12 NIGHT12 WR WR WN WR WR DAY12 DAY12 WR WR WN WR WR NIGHT12 NIGHT12 WR WR WN WR WR DAY12 N III III III III III DW',
  YELLOW:
    'WR WR DAY12 DAY12 WR WR WN WR WR NIGHT12 NIGHT12 WR WR WN WR WR DAY12 DAY12 WR WR WN WR WR NIGHT12 N II II II II II DW',
  RED: 'III III DW N II II II II II DW N I I I I I DW N III III III III III DW N WR WR WR WR WR DAY12',
  WHITE:
    'II II DW N I I I I I DW N III III III III III DW N II II II II II DW N I I I I I DW',
  BLUE: 'I I DW N III III III III III DW N II II II II II DW N I I I I I DW N WR DW WN WR WR NIGHT12',
  INDIVIDUAL:
    'II II DW N I I I I I DW N I I I I I DW N I I I I I DW N WR WR WN WR WR NIGHT12',
} as const;

const intervals = {
  I: ['DAY', '06:00', '14:00', 8],
  II: ['DAY', '14:00', '22:00', 8],
  III: ['NIGHT', '22:00', '06:00', 8],
  DAY12: ['DAY', '06:00', '18:00', 12],
  NIGHT12: ['NIGHT', '18:00', '06:00', 12],
} as const;

export function october2026Schedule(
  brigade: EmployeeColorShift | null,
  employeeId: string | null = null,
): BrigadeScheduleDay[] {
  const departmentId = brigade ? 'headliner-bmw' : 'utrzymanie-ruchu';
  return (calendars[brigade ?? 'INDIVIDUAL'].split(' ') as Code[]).map(
    (code, index) => {
      const date = `2026-10-${String(index + 1).padStart(2, '0')}`;
      const interval = intervals[code as keyof typeof intervals];
      return {
        id: `${departmentId}_${brigade ?? 'individual'}_${employeeId ?? 'brigade'}_${date}`,
        departmentId,
        brigade,
        employeeId,
        date,
        status: 'ACTIVE',
        note: null,
        kind: interval?.[0] ?? 'DAY_OFF',
        startTime: interval?.[1] ?? null,
        endTime: interval?.[2] ?? null,
        plannedHours: interval?.[3] ?? 0,
        ...(!interval ? { dayOffCode: code as BrigadeDayOffCode } : {}),
      };
    },
  );
}
