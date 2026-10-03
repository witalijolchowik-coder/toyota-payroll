import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';
import { interpolate } from '../../i18n/pl';
import type {
  Absence,
  DailyValue,
  Department,
  Employee,
  EmployeeAssignment,
} from '../../types/firestore';
import { resolveEmploymentCoveredAbsence } from '../../utils/absences';
import { resolveBalanceCalendarDeviation } from '../../utils/payroll/balanceSourceDeviation';
import { plannedNightContext } from '../../utils/payroll/plannedNightContext';
import {
  resolveAttendanceWarnings,
  manualAbsenceOverridesImportedAttendance,
} from '../../utils/attendance';
import {
  intervalHours,
  resolveDailyWorkTimeDeviation,
} from '../../utils/payroll';
import {
  isDayWithinEmployment,
  resolveSettlementCellValue,
  type CalendarDay,
  type SettlementCellValue,
} from './monthUtils';
import { activeContracts } from '../../utils/employees';
import {
  appearanceKeyForAbsence,
  appearanceKeyForPlannedDay,
} from '../../utils/calendarAppearance';
import { EffectiveAssignmentLabel } from './EffectiveAssignmentLabel';

interface EmployeeCalendarDialogProps {
  employee: Employee;
  monthLabel: string;
  days: CalendarDay[];
  dailyValues: DailyValue[];
  absences: Absence[];
  departments: Department[];
  employeeAssignments: EmployeeAssignment[];
  isSettled: boolean;
  onClose: () => void;
  onEditDay: (
    day: CalendarDay,
    value: SettlementCellValue,
    hasGoverningAbsence: boolean,
    plannedDay?: import('../../utils/schedule').PlannedScheduleDay,
  ) => void;
  plannedSchedule?: import('../../utils/schedule').PlannedScheduleDay[];
}

const weekdayLabels = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];
const formatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

export function EmployeeCalendarDialog({
  employee,
  monthLabel,
  days,
  dailyValues,
  absences,
  departments,
  employeeAssignments,
  isSettled,
  onClose,
  onEditDay,
  plannedSchedule = [],
}: EmployeeCalendarDialogProps) {
  const t = useTranslations();
  const { palette } = useCalendarAppearance();
  const dailyValuesByDate = new Map(
    dailyValues
      .filter((value) => value.employeeId === employee.id)
      .map((value) => [value.date, value]),
  );
  const plannedScheduleByDate = new Map(
    plannedSchedule.map((day) => [day.date, day]),
  );
  const employeeAbsences = absences.filter(
    (absence) => absence.employeeId === employee.id,
  );
  const leadingEmptyDays =
    days.length > 0 ? (days[0]!.date.getUTCDay() + 6) % 7 : 0;
  const cells = [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({
      kind: 'empty' as const,
      id: `empty-${index}`,
    })),
    ...days.map((day) => ({ kind: 'day' as const, day, id: day.isoDate })),
  ];
  const employeeName = `${employee.lastName} ${employee.firstName}`;
  const employmentLabel = activeContracts(employee)
    .map((contract) =>
      interpolate(t.settlement.employeeCalendar.employment, {
        start: formatter.format(
          new Date(`${contract.startDate}T00:00:00.000Z`),
        ),
        end: contract.endDate
          ? formatter.format(new Date(`${contract.endDate}T00:00:00.000Z`))
          : t.settlement.employeeCalendar.noEndDate,
      }),
    )
    .join(', ');

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <CalendarMonthOutlined color="primary" />
          <span>{t.settlement.employeeCalendar.title}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <Chip label={employeeName} />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.employeeCalendar.teta, {
                teta: employee.tetaNumber,
              })}
            />
            <Chip variant="outlined" label={monthLabel} />
            <Chip
              variant="outlined"
              label={
                employmentLabel || t.settlement.employeeCalendar.noStartDate
              }
            />
            <Chip
              variant="outlined"
              label={
                <EffectiveAssignmentLabel
                  employee={employee}
                  dates={days.map((day) => day.isoDate)}
                  assignments={employeeAssignments}
                  departments={departments}
                  showDepartment
                />
              }
            />
          </Stack>

          {isSettled ? (
            <Typography color="text.secondary">
              {t.settlement.employeeCalendar.settledReadOnly}
            </Typography>
          ) : (
            <Typography color="text.secondary">
              {t.settlement.employeeCalendar.helper}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(92px, 1fr))',
              gap: 1,
            }}
          >
            {weekdayLabels.map((label) => (
              <Typography
                key={label}
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 800, textAlign: 'center' }}
              >
                {label}
              </Typography>
            ))}
            {cells.map((cell) => {
              if (cell.kind === 'empty') {
                return <Box key={cell.id} />;
              }
              const persistedValue = dailyValuesByDate.get(cell.day.isoDate);
              const plannedDay = plannedScheduleByDate.get(cell.day.isoDate);
              const value = resolveSettlementCellValue({
                employee,
                day: cell.day,
                persistedValue,
                plannedDay,
              });
              const absenceResolution = resolveEmploymentCoveredAbsence(
                employee,
                employeeAbsences,
                cell.day.isoDate,
              );
              const absenceLabel =
                absenceResolution.kind === 'governed'
                  ? absenceResolution.code === 'L4' &&
                    absenceResolution.confirmation === 'reported'
                    ? t.settlement.grid.reportedL4Label
                    : absenceResolution.code
                  : absenceResolution.kind === 'ambiguous'
                    ? absenceResolution.codes.join('/')
                    : null;
              const appearanceKey =
                absenceResolution.kind === 'governed'
                  ? appearanceKeyForAbsence(
                      absenceResolution.code,
                      absenceResolution.confirmation,
                    )
                  : appearanceKeyForPlannedDay(plannedDay);
              const manualAbsenceOverridesImport =
                manualAbsenceOverridesImportedAttendance(
                  persistedValue,
                  absenceResolution,
                );
              const warnings = resolveAttendanceWarnings({
                hasExplicitValue: (value.hours ?? 0) > 0,
                hasActiveAbsence: absenceResolution.kind !== 'none',
                manualAbsenceOverridesImport,
                isWorkingDay:
                  plannedDay === undefined
                    ? cell.day.isWorkingDay
                    : plannedDay.status === 'WORKING' ||
                      plannedDay.status === 'BHP',
                isWithinEmployment: isDayWithinEmployment(employee, cell.day),
              });
              const canEdit =
                !isSettled &&
                !cell.day.isFuture &&
                value.calendarState !== 'outside-employment';
              const hoursLabel =
                value.hours === null
                  ? t.settlement.grid.empty
                  : interpolate(t.settlement.grid.hours, {
                      hours: value.hours.toLocaleString('pl-PL'),
                    });
              const workTimeBreakdown = manualAbsenceOverridesImport
                ? null
                : value.balanceSourceFacts
                  ? resolveBalanceCalendarDeviation(
                      value.balanceSourceFacts,
                      cell.day.isoDate,
                      cell.day.isHoliday,
                      plannedDay,
                    ).deviation
                  : value.workTimeCorrection
                    ? resolveDailyWorkTimeDeviation({
                        ...plannedNightContext(plannedDay),
                        planned:
                          value.workTimeCorrection.workContext !== 'EXTRA' &&
                          value.workTimeCorrection.plannedShift &&
                          value.workTimeCorrection.plannedStartTime &&
                          value.workTimeCorrection.plannedEndTime
                            ? {
                                shift: value.workTimeCorrection.plannedShift,
                                startTime:
                                  value.workTimeCorrection.plannedStartTime,
                                endTime:
                                  value.workTimeCorrection.plannedEndTime,
                              }
                            : null,
                        actual: {
                          startTime: value.workTimeCorrection.actualStartTime,
                          endTime: value.workTimeCorrection.actualEndTime,
                        },
                        isWorkingDay:
                          value.workTimeCorrection.workContext === 'EXTRA'
                            ? false
                            : plannedDay?.status === 'WORKING' ||
                              plannedDay?.status === 'BHP',
                        isSaturday: cell.day.date.getUTCDay() === 6,
                        isSunday: cell.day.date.getUTCDay() === 0,
                        isPublicHoliday: cell.day.isHoliday,
                      })
                    : null;

              return (
                <Tooltip
                  key={cell.id}
                  title={
                    warnings.length > 0
                      ? warnings
                          .map((warning) => t.settlement.grid.warnings[warning])
                          .join(' ')
                      : ''
                  }
                >
                  <Box component="span">
                    <ButtonBase
                      disabled={!canEdit}
                      onClick={() =>
                        onEditDay(
                          cell.day,
                          value,
                          absenceResolution.kind !== 'none',
                          plannedDay,
                        )
                      }
                      sx={{
                        display: 'block',
                        width: '100%',
                        minHeight: 94,
                        p: 1,
                        textAlign: 'left',
                        border: 1,
                        borderColor:
                          warnings.length > 0
                            ? palette.warning.text
                            : 'divider',
                        borderRadius: 2,
                        bgcolor:
                          value.calendarState === 'outside-employment'
                            ? palette.outsideEmployment.background
                            : cell.day.isFuture
                              ? palette.future.background
                              : absenceLabel
                                ? palette[appearanceKey].background
                                : cell.day.isHoliday
                                  ? palette.publicHoliday.background
                                  : cell.day.isWeekend
                                    ? palette.weekend.background
                                    : palette[appearanceKey].background,
                        color:
                          value.calendarState === 'outside-employment'
                            ? palette.outsideEmployment.text
                            : cell.day.isFuture
                              ? palette.future.text
                              : palette[appearanceKey].text,
                        opacity:
                          value.calendarState === 'outside-employment' ||
                          cell.day.isFuture
                            ? 0.55
                            : 1,
                        '&.Mui-disabled': { opacity: 0.7 },
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Typography variant="subtitle2">
                          {cell.day.dayOfMonth}
                        </Typography>
                        {absenceLabel ? (
                          <Typography
                            variant="body2"
                            color={
                              absenceResolution.kind === 'governed' &&
                              absenceResolution.confirmation === 'reported'
                                ? palette.l4Reported.text
                                : palette[appearanceKey].text
                            }
                            sx={{ fontWeight: 800 }}
                          >
                            {absenceLabel}
                          </Typography>
                        ) : null}
                        {plannedDay?.plannedStartTime &&
                        plannedDay.plannedEndTime &&
                        plannedDay.plannedDuration !== null ? (
                          <Typography variant="caption" color="text.secondary">
                            {interpolate(
                              t.settlement.editor.workTime.planDetails,
                              {
                                start: plannedDay.plannedStartTime,
                                end: plannedDay.plannedEndTime,
                                hours:
                                  plannedDay.plannedDuration.toLocaleString(
                                    'pl-PL',
                                  ),
                              },
                            )}
                          </Typography>
                        ) : null}
                        {!manualAbsenceOverridesImport ? (
                          <Typography
                            variant="body2"
                            color={
                              value.kind === 'manual' ||
                              value.kind === 'imported-override'
                                ? palette.manualCorrection.text
                                : palette[appearanceKey].text
                            }
                            sx={{
                              fontWeight:
                                value.kind === 'manual' ||
                                value.kind === 'imported-override'
                                  ? 800
                                  : 500,
                            }}
                          >
                            {hoursLabel}
                          </Typography>
                        ) : null}
                        {value.workTimeCorrection &&
                        !manualAbsenceOverridesImport ? (
                          <Typography
                            variant="caption"
                            sx={{ color: palette.manualCorrection.text }}
                          >
                            {interpolate(
                              t.settlement.employeeCalendar.actualInterval,
                              {
                                start: value.workTimeCorrection.actualStartTime,
                                end: value.workTimeCorrection.actualEndTime,
                              },
                            )}
                          </Typography>
                        ) : null}
                        {workTimeBreakdown && value.workTimeCorrection ? (
                          <Typography variant="caption" color="text.secondary">
                            {interpolate(
                              value.workTimeCorrection.plannedStartTime &&
                                value.workTimeCorrection.plannedEndTime
                                ? t.settlement.editor.workTime.previewExtended
                                : t.settlement.editor.workTime.previewExtra,
                              {
                                planned:
                                  value.workTimeCorrection.plannedStartTime &&
                                  value.workTimeCorrection.plannedEndTime
                                    ? intervalHours({
                                        startTime:
                                          value.workTimeCorrection
                                            .plannedStartTime,
                                        endTime:
                                          value.workTimeCorrection
                                            .plannedEndTime,
                                      }).toLocaleString('pl-PL')
                                    : '0',
                                actual: intervalHours({
                                  startTime:
                                    value.workTimeCorrection.actualStartTime,
                                  endTime:
                                    value.workTimeCorrection.actualEndTime,
                                }).toLocaleString('pl-PL'),
                                private:
                                  workTimeBreakdown.privateTimeHours.toLocaleString(
                                    'pl-PL',
                                  ),
                                overtime50:
                                  workTimeBreakdown.overtime50Hours.toLocaleString(
                                    'pl-PL',
                                  ),
                                overtime100:
                                  workTimeBreakdown.overtime100Hours.toLocaleString(
                                    'pl-PL',
                                  ),
                                night:
                                  workTimeBreakdown.nightAllowanceHours.toLocaleString(
                                    'pl-PL',
                                  ),
                              },
                            )}
                          </Typography>
                        ) : null}
                        {warnings.length > 0 ? (
                          <Typography
                            variant="caption"
                            sx={{ color: palette.warning.text }}
                          >
                            {t.settlement.employeeCalendar.warning}
                          </Typography>
                        ) : null}
                      </Stack>
                    </ButtonBase>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.settlement.employeeCalendar.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
