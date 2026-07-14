import type { ActualWorkingShift } from '../../types/firestore';

export type Overtime100Reason =
  'NIGHT' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY';

export interface ClockInterval {
  startTime: string;
  endTime: string;
}

export interface PlannedWorkInterval extends ClockInterval {
  shift: ActualWorkingShift;
}

export interface WorkTimeClassificationOverride {
  privateTimeHours?: number | null;
  overtime50Hours?: number | null;
  overtime100Hours?: number | null;
  coverableNiHours?: number | null;
}

export interface DailyWorkTimeDeviationInput {
  planned: PlannedWorkInterval;
  actual?: ClockInterval | null;
  isWorkingDay: boolean;
  isSaturday?: boolean;
  isSunday?: boolean;
  isPublicHoliday?: boolean;
  classificationOverride?: WorkTimeClassificationOverride | null;
}

export interface WorkTimeSegment {
  startMinute: number;
  endMinute: number;
  hours: number;
}

export interface DailyWorkTimeDeviation {
  normalWorkHours: number;
  privateTimeHours: number;
  extraHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  overtime100Reasons: Overtime100Reason[];
  coverableNiHours: number;
  holidayWorkBonusEligible: boolean;
  nightOvertimeHours: number;
  nightAllowanceHours: number;
  unresolved: boolean;
}

export interface MonthlyWorkTimeBalanceInput {
  privateTimeHours: number;
  coverableNiHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
}

export interface MonthlyWorkTimeBalance {
  privateTimeHours: number;
  privateTimeCoveredHours: number;
  uncoveredPrivateTimeHours: number;
  coverableNiHours: number;
  coverableNiCoveredHours: number;
  uncoveredCoverableNiHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  paidOvertime50Hours: number;
  paidOvertime100Hours: number;
  niedoczasHours: number;
}

export const DEFAULT_SHIFT_INTERVALS: Record<
  ActualWorkingShift,
  ClockInterval
> = {
  FIRST: { startTime: '06:00', endTime: '14:00' },
  SECOND: { startTime: '14:00', endTime: '22:00' },
  NIGHT: { startTime: '22:00', endTime: '06:00' },
};

const MINUTES_PER_DAY = 24 * 60;
const NIGHT_WINDOWS = [
  { start: 0, end: 6 * 60 },
  { start: 22 * 60, end: MINUTES_PER_DAY },
  { start: MINUTES_PER_DAY, end: MINUTES_PER_DAY + 6 * 60 },
];

export function isValidClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function plannedIntervalForShift(
  shift: ActualWorkingShift,
): PlannedWorkInterval {
  const interval = DEFAULT_SHIFT_INTERVALS[shift];
  return { shift, ...interval };
}

export function intervalHours(interval: ClockInterval): number {
  const normalized = normalizeInterval(interval);
  return roundHours((normalized.end - normalized.start) / 60);
}

export function resolveDailyWorkTimeDeviation({
  planned,
  actual,
  isWorkingDay,
  isSaturday = false,
  isSunday = false,
  isPublicHoliday = false,
  classificationOverride = null,
}: DailyWorkTimeDeviationInput): DailyWorkTimeDeviation {
  const plannedInterval = normalizeInterval(planned);
  const actualInterval = normalizeInterval(actual ?? planned, plannedInterval);
  const dayIs100 = isSaturday || isSunday || isPublicHoliday;

  if (!isWorkingDay) {
    const overtime100Hours = roundHours(
      (actualInterval.end - actualInterval.start) / 60,
    );
    return applyClassificationOverride(
      {
        normalWorkHours: 0,
        privateTimeHours: 0,
        extraHours: overtime100Hours,
        overtime50Hours: 0,
        overtime100Hours,
        overtime100Reasons: nonWorkingReasons({
          isSaturday,
          isSunday,
          isPublicHoliday,
        }),
        coverableNiHours: 0,
        holidayWorkBonusEligible: isPublicHoliday && overtime100Hours > 0,
        nightOvertimeHours: 0,
        nightAllowanceHours: 0,
        unresolved: false,
      },
      classificationOverride,
    );
  }

  const overlap = intersectionHours(plannedInterval, actualInterval);
  const privateTimeHours = roundHours(
    Math.max(0, plannedInterval.end - plannedInterval.start) / 60 - overlap,
  );
  const extraSegments = extraWorkSegments(plannedInterval, actualInterval);
  const overtime100FromNight = extraSegments.reduce(
    (total, segment) => total + nightOverlapHours(segment),
    0,
  );
  const extraHours = roundHours(
    extraSegments.reduce((total, segment) => total + segment.hours, 0),
  );
  const overtime100Hours = dayIs100
    ? extraHours
    : roundHours(overtime100FromNight);
  const overtime50Hours = dayIs100
    ? 0
    : roundHours(Math.max(0, extraHours - overtime100Hours));

  return applyClassificationOverride(
    {
      normalWorkHours: overlap,
      privateTimeHours,
      extraHours,
      overtime50Hours,
      overtime100Hours,
      overtime100Reasons:
        overtime100Hours > 0
          ? [
              ...nonWorkingReasons({
                isSaturday,
                isSunday,
                isPublicHoliday,
              }),
              ...(overtime100FromNight > 0 ? ['NIGHT' as const] : []),
            ]
          : [],
      coverableNiHours: 0,
      holidayWorkBonusEligible: isPublicHoliday && extraHours > 0,
      nightOvertimeHours: roundHours(overtime100FromNight),
      nightAllowanceHours: 0,
      unresolved: false,
    },
    classificationOverride,
  );
}

export function balanceMonthlyWorkTimeDeviations({
  privateTimeHours,
  coverableNiHours,
  overtime50Hours,
  overtime100Hours,
}: MonthlyWorkTimeBalanceInput): MonthlyWorkTimeBalance {
  const privateCoverageFrom50 = Math.min(privateTimeHours, overtime50Hours);
  const remainingPrivateAfter50 = privateTimeHours - privateCoverageFrom50;
  const privateCoverageFrom100 = Math.min(
    remainingPrivateAfter50,
    overtime100Hours,
  );
  const privateTimeCoveredHours = roundHours(
    privateCoverageFrom50 + privateCoverageFrom100,
  );

  const remainingOvertime50 = roundHours(
    overtime50Hours - privateCoverageFrom50,
  );
  const remainingOvertime100 = roundHours(
    overtime100Hours - privateCoverageFrom100,
  );

  const coverableCoverageFrom50 = Math.min(
    coverableNiHours,
    remainingOvertime50,
  );
  const remainingCoverableAfter50 = coverableNiHours - coverableCoverageFrom50;
  const coverableCoverageFrom100 = Math.min(
    remainingCoverableAfter50,
    remainingOvertime100,
  );
  const coverableNiCoveredHours = roundHours(
    coverableCoverageFrom50 + coverableCoverageFrom100,
  );

  return {
    privateTimeHours: roundHours(privateTimeHours),
    privateTimeCoveredHours,
    uncoveredPrivateTimeHours: roundHours(
      privateTimeHours - privateTimeCoveredHours,
    ),
    coverableNiHours: roundHours(coverableNiHours),
    coverableNiCoveredHours,
    uncoveredCoverableNiHours: roundHours(
      coverableNiHours - coverableNiCoveredHours,
    ),
    overtime50Hours: roundHours(overtime50Hours),
    overtime100Hours: roundHours(overtime100Hours),
    paidOvertime50Hours: roundHours(
      remainingOvertime50 - coverableCoverageFrom50,
    ),
    paidOvertime100Hours: roundHours(
      remainingOvertime100 - coverableCoverageFrom100,
    ),
    niedoczasHours: roundHours(
      privateTimeHours -
        privateTimeCoveredHours +
        coverableNiHours -
        coverableNiCoveredHours,
    ),
  };
}

function applyClassificationOverride(
  calculated: DailyWorkTimeDeviation,
  override: WorkTimeClassificationOverride | null,
): DailyWorkTimeDeviation {
  if (!override) {
    return calculated;
  }

  return {
    ...calculated,
    privateTimeHours: override.privateTimeHours ?? calculated.privateTimeHours,
    overtime50Hours: override.overtime50Hours ?? calculated.overtime50Hours,
    overtime100Hours: override.overtime100Hours ?? calculated.overtime100Hours,
    coverableNiHours: override.coverableNiHours ?? calculated.coverableNiHours,
    unresolved: false,
  };
}

function normalizeInterval(
  interval: ClockInterval,
  relativeTo?: { start: number; end: number },
) {
  if (
    !isValidClockTime(interval.startTime) ||
    !isValidClockTime(interval.endTime)
  ) {
    throw new Error('Invalid clock time.');
  }

  let start = parseClockMinutes(interval.startTime);
  let end = parseClockMinutes(interval.endTime);
  if (end < start) {
    end += MINUTES_PER_DAY;
  }

  if (relativeTo && start + MINUTES_PER_DAY / 2 < relativeTo.start) {
    start += MINUTES_PER_DAY;
    end += MINUTES_PER_DAY;
  }

  return { start, end };
}

function parseClockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}

function intersectionHours(
  first: { start: number; end: number },
  second: { start: number; end: number },
): number {
  return roundHours(
    Math.max(
      0,
      Math.min(first.end, second.end) - Math.max(first.start, second.start),
    ) / 60,
  );
}

function extraWorkSegments(
  planned: { start: number; end: number },
  actual: { start: number; end: number },
): WorkTimeSegment[] {
  const segments: WorkTimeSegment[] = [];
  if (actual.start < planned.start) {
    segments.push(segment(actual.start, Math.min(actual.end, planned.start)));
  }
  if (actual.end > planned.end) {
    segments.push(segment(Math.max(actual.start, planned.end), actual.end));
  }
  return segments.filter((item) => item.hours > 0);
}

function segment(startMinute: number, endMinute: number): WorkTimeSegment {
  return {
    startMinute,
    endMinute,
    hours: roundHours((endMinute - startMinute) / 60),
  };
}

function nightOverlapHours(segment: WorkTimeSegment): number {
  return roundHours(
    NIGHT_WINDOWS.reduce((total, window) => {
      const overlap = Math.max(
        0,
        Math.min(segment.endMinute, window.end) -
          Math.max(segment.startMinute, window.start),
      );
      return total + overlap / 60;
    }, 0),
  );
}

function nonWorkingReasons({
  isSaturday,
  isSunday,
  isPublicHoliday,
}: {
  isSaturday: boolean;
  isSunday: boolean;
  isPublicHoliday: boolean;
}): Overtime100Reason[] {
  return [
    ...(isSaturday ? ['SATURDAY' as const] : []),
    ...(isSunday ? ['SUNDAY' as const] : []),
    ...(isPublicHoliday ? ['PUBLIC_HOLIDAY' as const] : []),
  ];
}

function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
