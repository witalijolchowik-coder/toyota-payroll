import type { PlannedScheduleDay } from '../../utils/schedule';

export function calendarDayOffLabel(day?: PlannedScheduleDay) {
  if (day?.status === 'PUBLIC_HOLIDAY') return 'ŚW';
  if (day?.status !== 'DAY_OFF') return null;
  if (day.brigadeScheduled) return day.label;
  if (day.source !== 'calendar') return day.label;
  const weekday = new Date(day.date + 'T00:00:00Z').getUTCDay();
  return weekday === 0 ? 'N' : weekday === 6 ? 'DW' : day.label;
}

export function compactBrigadeShiftLabel(day?: PlannedScheduleDay) {
  if (!day?.brigadeScheduled || day.status !== 'WORKING' || day.hours !== 12) {
    return null;
  }
  if (
    day.shift === 'FIRST' &&
    day.plannedStartTime === '06:00' &&
    day.plannedEndTime === '18:00'
  ) {
    return 'D12';
  }
  if (
    day.shift === 'NIGHT' &&
    day.plannedStartTime === '18:00' &&
    day.plannedEndTime === '06:00'
  ) {
    return 'N12';
  }
  return null;
}
