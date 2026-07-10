import {
  Alert,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type { Department, Employee } from '../../types/firestore';
import type {
  EmployeeMonthlyCalculationDraft,
  PayrollDraftWarningCode,
} from '../../utils/payroll';

interface PayrollDraftPanelProps {
  drafts: EmployeeMonthlyCalculationDraft[];
  employees: Employee[];
  departments: Department[];
}

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

export function PayrollDraftPanel({
  drafts,
  employees,
  departments,
}: PayrollDraftPanelProps) {
  const t = useTranslations();
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const totals = drafts.reduce(
    (current, draft) => ({
      workedHours: current.workedHours + draft.totals.workedHours,
      nominalHours: current.nominalHours + draft.totals.nominalHours,
      virtualHours: current.virtualHours + draft.attendance.virtualHours,
      privateTime: current.privateTime + draft.workTime.privateTimeHours,
      niedoczas: current.niedoczas + draft.workTime.niedoczasHours,
      paidOvertime50:
        current.paidOvertime50 + draft.workTime.paidOvertime50Hours,
      paidOvertime100:
        current.paidOvertime100 + draft.workTime.paidOvertime100Hours,
      l4Hours: current.l4Hours + draft.absences.l4Hours,
      vacationHours: current.vacationHours + draft.absences.vacationHours,
      otherAbsenceHours:
        current.otherAbsenceHours + draft.absences.otherAbsenceHours,
      frequencyBonus:
        current.frequencyBonus + (draft.totals.frequencyBonusAmount ?? 0),
      holidayBonus:
        current.holidayBonus + draft.components.holidayWorkBonusBrutto,
      transportNetto:
        current.transportNetto + draft.components.transportAllowanceNetto,
      laundry: current.laundry + draft.components.laundryAllowanceBrutto,
      udt: current.udt + draft.components.udtAllowanceBrutto,
      housingDeduction:
        current.housingDeduction +
        draft.components.companyAccommodationDeduction,
      increases: current.increases + draft.totals.manualIncreases,
      decreases: current.decreases + draft.totals.manualDecreases,
      bruttoAdditions: current.bruttoAdditions + draft.totals.bruttoAdditions,
      nettoAllowances: current.nettoAllowances + draft.totals.nettoAllowances,
      deductions: current.deductions + draft.totals.deductions,
      warnings: current.warnings + draft.warnings.length,
    }),
    {
      workedHours: 0,
      nominalHours: 0,
      virtualHours: 0,
      privateTime: 0,
      niedoczas: 0,
      paidOvertime50: 0,
      paidOvertime100: 0,
      l4Hours: 0,
      vacationHours: 0,
      otherAbsenceHours: 0,
      frequencyBonus: 0,
      holidayBonus: 0,
      transportNetto: 0,
      laundry: 0,
      udt: 0,
      housingDeduction: 0,
      increases: 0,
      decreases: 0,
      bruttoAdditions: 0,
      nettoAllowances: 0,
      deductions: 0,
      warnings: 0,
    },
  );
  const hasMissingFrequencySetting = drafts.some((draft) =>
    draft.warnings.some(
      (warning) => warning.code === 'unresolved-frequency-bonus-setting',
    ),
  );

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <div>
            <Typography variant="h6">{t.settlement.draft.title}</Typography>
            <Typography color="text.secondary">
              {t.settlement.draft.description}
            </Typography>
          </div>

          {hasMissingFrequencySetting ? (
            <Alert severity="warning">
              {t.settlement.draft.missingFrequencySetting}
            </Alert>
          ) : null}

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <SummaryChip
              label={t.settlement.draft.totals.nominal}
              value={formatHours(totals.nominalHours, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.worked}
              value={formatHours(totals.workedHours, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.virtual}
              value={formatHours(totals.virtualHours, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.privateTime}
              value={formatHours(totals.privateTime, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.niedoczas}
              value={formatHours(totals.niedoczas, t)}
              color={totals.niedoczas > 0 ? 'warning' : 'default'}
            />
            <SummaryChip
              label={t.settlement.draft.totals.overtime50}
              value={formatHours(totals.paidOvertime50, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.overtime100}
              value={formatHours(totals.paidOvertime100, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.l4}
              value={formatHours(totals.l4Hours, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.vacation}
              value={formatHours(totals.vacationHours, t)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.frequencyBonus}
              value={currencyFormatter.format(totals.frequencyBonus)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.holidayBonus}
              value={currencyFormatter.format(totals.holidayBonus)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.transportNetto}
              value={currencyFormatter.format(totals.transportNetto)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.laundry}
              value={currencyFormatter.format(totals.laundry)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.bruttoAdditions}
              value={currencyFormatter.format(totals.bruttoAdditions)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.deductions}
              value={currencyFormatter.format(totals.deductions)}
            />
            <SummaryChip
              label={t.settlement.draft.totals.warnings}
              value={totals.warnings.toLocaleString('pl-PL')}
              color={totals.warnings > 0 ? 'warning' : 'default'}
            />
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t.settlement.draft.table.teta}</TableCell>
                  <TableCell>{t.settlement.draft.table.employee}</TableCell>
                  <TableCell>{t.settlement.draft.table.department}</TableCell>
                  <TableCell>
                    {t.settlement.draft.table.shiftAssignment}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.nominal}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.worked}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.virtual}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.privateTime}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.overtime}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.niedoczas}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.absences}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.frequencyBonus}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.transportNetto}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.bruttoAdditions}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.draft.table.deductions}
                  </TableCell>
                  <TableCell>{t.settlement.draft.table.warnings}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drafts.map((draft) => {
                  const employee = employeesById.get(draft.employeeId);
                  const employeeName = employee
                    ? `${employee.lastName} ${employee.firstName}`
                    : t.settlement.draft.table.unknownEmployee;
                  return (
                    <TableRow key={draft.employeeId} hover>
                      <TableCell>{draft.tetaNumber}</TableCell>
                      <TableCell>{employeeName}</TableCell>
                      <TableCell>
                        {employee?.departmentId
                          ? (departmentsById.get(employee.departmentId)?.name ??
                            employee.departmentId)
                          : t.organization.departments.unassigned}
                      </TableCell>
                      <TableCell>
                        {employee?.shiftAssignment
                          ? t.organization.shifts[employee.shiftAssignment]
                          : t.organization.shifts.unassigned}
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(draft.totals.nominalHours, t)}
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(draft.totals.workedHours, t)}
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(draft.attendance.virtualHours, t)}
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(draft.workTime.privateTimeHours, t)}
                      </TableCell>
                      <TableCell align="right">
                        {interpolate(t.settlement.draft.table.overtimeSplit, {
                          overtime50: formatPlainHours(
                            draft.workTime.paidOvertime50Hours,
                          ),
                          overtime100: formatPlainHours(
                            draft.workTime.paidOvertime100Hours,
                          ),
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {formatHours(draft.workTime.niedoczasHours, t)}
                      </TableCell>
                      <TableCell align="right">
                        {interpolate(t.settlement.draft.table.absenceSplit, {
                          l4: formatPlainHours(draft.absences.l4Hours),
                          vacation: formatPlainHours(
                            draft.absences.vacationHours,
                          ),
                          other: formatPlainHours(
                            draft.absences.otherAbsenceHours,
                          ),
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {draft.totals.frequencyBonusAmount === null
                          ? t.settlement.grid.empty
                          : currencyFormatter.format(
                              draft.totals.frequencyBonusAmount,
                            )}
                      </TableCell>
                      <TableCell align="right">
                        {currencyFormatter.format(
                          draft.components.transportAllowanceNetto,
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {currencyFormatter.format(draft.totals.bruttoAdditions)}
                      </TableCell>
                      <TableCell align="right">
                        {currencyFormatter.format(draft.totals.deductions)}
                      </TableCell>
                      <TableCell>
                        {draft.warnings.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            {t.settlement.draft.table.noWarnings}
                          </Typography>
                        ) : (
                          <Stack spacing={0.5}>
                            {draft.warnings.slice(0, 3).map((warning) => (
                              <Typography
                                key={`${warning.code}:${warning.date ?? ''}`}
                                variant="caption"
                                color="warning.dark"
                              >
                                {warning.date
                                  ? interpolate(
                                      t.settlement.draft.warningWithDate,
                                      {
                                        date: warning.date,
                                        warning: warningMessage(
                                          warning.code,
                                          t,
                                        ),
                                      },
                                    )
                                  : warningMessage(warning.code, t)}
                              </Typography>
                            ))}
                            {draft.warnings.length > 3 ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {interpolate(t.settlement.draft.moreWarnings, {
                                  count: (draft.warnings.length - 3).toString(),
                                })}
                              </Typography>
                            ) : null}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>
    </Card>
  );
}

function SummaryChip({
  label,
  value,
  color = 'default',
}: {
  label: string;
  value: string;
  color?: 'default' | 'warning';
}) {
  return (
    <Chip
      variant="outlined"
      color={color}
      label={
        <Stack component="span" direction="row" spacing={0.5}>
          <Typography component="span" variant="caption">
            {label}
          </Typography>
          <Typography
            component="span"
            variant="caption"
            sx={{ fontWeight: 800 }}
          >
            {value}
          </Typography>
        </Stack>
      }
    />
  );
}

function formatHours(hours: number, t: ReturnType<typeof useTranslations>) {
  return interpolate(t.settlement.grid.hours, {
    hours: hours.toLocaleString('pl-PL'),
  });
}

function formatPlainHours(hours: number) {
  return hours.toLocaleString('pl-PL');
}

function warningMessage(
  code: PayrollDraftWarningCode,
  t: ReturnType<typeof useTranslations>,
): string {
  return t.settlement.draft.warnings[code];
}
