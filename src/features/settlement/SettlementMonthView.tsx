import { useState } from 'react';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { useNotification } from '../../hooks/useNotification';
import { interpolate } from '../../i18n/pl';
import {
  SettlementServiceError,
  type SettlementServiceErrorCode,
} from '../../services/settlementService';
import {
  clearManualDailyValue,
  saveManualDailyValue,
} from '../../services/dailyValueService';
import type { Employee, MonthId } from '../../types/firestore';
import { calculateMonthlyDrafts } from '../../utils/payroll';
import { DailyValueEditorDialog } from './DailyValueEditorDialog';
import {
  createCalendarDays,
  employeeParticipatesInMonth,
  getMonthDateRange,
  type CalendarDay,
  type SettlementCellValue,
} from './monthUtils';
import { PayrollDraftPanel } from './PayrollDraftPanel';
import { getPublicHolidaysForYear } from './publicHolidays';
import { SettlementGrid } from './SettlementGrid';
import { SettlementLegend } from './SettlementLegend';
import { useSettlementMonth } from './useSettlementMonth';

interface SettlementMonthViewProps {
  monthId: MonthId;
}

const monthFormatter = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function SettlementMonthView({ monthId }: SettlementMonthViewProps) {
  const t = useTranslations();
  const { notify } = useNotification();
  const { data, error, isLoading, isCreating, createMonth, reload } =
    useSettlementMonth(monthId);
  const [editingCell, setEditingCell] = useState<{
    employee: Employee;
    day: CalendarDay;
    value: SettlementCellValue;
    hasGoverningAbsence: boolean;
  } | null>(null);

  if (isLoading) {
    return (
      <Card aria-label={t.settlement.loading}>
        <CardContent>
          <Stack spacing={2}>
            <Skeleton width={240} height={32} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <strong>{t.settlement.errors.title}</strong>
        <br />
        {settlementErrorMessage(error, t)}
      </Alert>
    );
  }

  const range = getMonthDateRange(monthId);
  const publicHolidays = getPublicHolidaysForYear(range.year);
  const days = createCalendarDays(monthId, {
    publicHolidays,
  });

  if (!data) {
    const handleCreateMonth = () => {
      void createMonth()
        .then(() => {
          notify({
            message: t.settlement.notifications.created,
            severity: 'success',
          });
        })
        .catch(() => undefined);
    };

    return (
      <Stack spacing={2}>
        <Card>
          <CardContent sx={{ py: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Typography variant="h6">
                  {t.settlement.missingMonth.title}
                </Typography>
                <Typography color="text.secondary">
                  {t.settlement.missingMonth.description}
                </Typography>
              </div>
              <Button
                variant="contained"
                onClick={handleCreateMonth}
                disabled={isCreating}
                startIcon={
                  isCreating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <CalendarMonthOutlined />
                  )
                }
              >
                {t.settlement.missingMonth.create}
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <SettlementGrid employees={[]} days={days} dailyValues={[]} />
      </Stack>
    );
  }

  const employeesWithoutStartDate = data.employees.filter(
    (employee) => !employee.employmentStartDate,
  );
  const participatingEmployees = data.employees.filter((employee) =>
    employeeParticipatesInMonth(employee, range),
  );
  const participatingEmployeeIds = new Set(
    participatingEmployees.map((employee) => employee.id),
  );
  const participatingDailyValues = data.dailyValues.filter((value) =>
    participatingEmployeeIds.has(value.employeeId),
  );
  const participatingAbsences = data.absences.filter((absence) =>
    participatingEmployeeIds.has(absence.employeeId),
  );
  const calculationDrafts = calculateMonthlyDrafts({
    monthId,
    employees: participatingEmployees,
    dailyValues: participatingDailyValues,
    absences: participatingAbsences,
    payrollSettings: data.payrollSettings,
    adjustments: data.adjustments,
    calendarOptions: { publicHolidays },
  });

  return (
    <Stack spacing={2.5}>
      {data.month.isSettled ? (
        <Alert severity="info">
          <strong>{t.settlement.settled.title}</strong>
          <br />
          {t.settlement.settled.description}
        </Alert>
      ) : null}

      {employeesWithoutStartDate.length > 0 ? (
        <Alert severity="warning">
          <strong>{t.settlement.incompleteEmployment.title}</strong>
          <br />
          {interpolate(t.settlement.incompleteEmployment.description, {
            count: employeesWithoutStartDate.length.toString(),
          })}
        </Alert>
      ) : null}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <div>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 750 }}
              >
                {monthFormatter.format(range.start)}
              </Typography>
              <Typography variant="h6">
                {interpolate(t.settlement.summary.employees, {
                  count: participatingEmployees.length.toString(),
                })}
              </Typography>
            </div>
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.summary.calculationVersion, {
                version: data.month.calculationVersion.toString(),
              })}
            />
          </Stack>
          <Box sx={{ mt: 2.5 }}>
            <SettlementLegend />
          </Box>
        </CardContent>
      </Card>

      {participatingEmployees.length > 0 ? (
        <>
          <SettlementGrid
            employees={participatingEmployees}
            days={days}
            dailyValues={participatingDailyValues}
            absences={participatingAbsences}
            isSettled={data.month.isSettled}
            onEditCell={(employee, day, value, hasGoverningAbsence) =>
              setEditingCell({
                employee,
                day,
                value,
                hasGoverningAbsence,
              })
            }
          />
          <PayrollDraftPanel
            drafts={calculationDrafts}
            employees={participatingEmployees}
          />
        </>
      ) : (
        <Card>
          <CardContent sx={{ py: 7, textAlign: 'center' }}>
            <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
              <GroupsOutlined color="disabled" sx={{ fontSize: 48 }} />
              <Typography variant="h6">{t.settlement.empty.title}</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
                {t.settlement.empty.description}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {editingCell ? (
        <DailyValueEditorDialog
          employee={editingCell.employee}
          day={editingCell.day}
          value={editingCell.value}
          hasGoverningAbsence={editingCell.hasGoverningAbsence}
          onClose={() => setEditingCell(null)}
          onSave={async (hours, note) => {
            await saveManualDailyValue(monthId, {
              employeeId: editingCell.employee.id,
              tetaNumber: editingCell.employee.tetaNumber,
              date: editingCell.day.isoDate,
              hours,
              note,
            });
            await reload();
            notify({
              message: t.settlement.notifications.dailyValueSaved,
              severity: 'success',
            });
          }}
          onClear={async () => {
            await clearManualDailyValue(
              monthId,
              editingCell.employee.id,
              editingCell.day.isoDate,
            );
            await reload();
            notify({
              message: t.settlement.notifications.dailyValueCleared,
              severity: 'success',
            });
          }}
        />
      ) : null}
    </Stack>
  );
}

function settlementErrorMessage(
  error: Error | null,
  t: ReturnType<typeof useTranslations>,
): string {
  const code = error instanceof SettlementServiceError ? error.code : undefined;
  return serviceErrorMessage(code, t);
}

function serviceErrorMessage(
  code: SettlementServiceErrorCode | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'firebase-unavailable') {
    return t.settlement.errors.firebaseUnavailable;
  }
  if (code === 'authentication-required') {
    return t.settlement.errors.authenticationRequired;
  }
  if (code === 'month-unavailable') {
    return t.settlement.errors.monthUnavailable;
  }
  return t.settlement.errors.generic;
}
