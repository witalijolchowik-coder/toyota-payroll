import { useMemo, useState } from 'react';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  Department,
  Employee,
  SettlementReviewState,
  SettlementReviewStatus,
  SettlementReviewUpdateInput,
} from '../../types/firestore';
import { routes } from '../../utils/routes';
import type { EmployeeMonthlyCalculationDraft } from '../../utils/payroll';
import {
  buildSettlementReviewItems,
  calculateSettlementReviewSummary,
  type EmployeeSettlementReviewItem,
  type SettlementReviewIssue,
  type SettlementReviewIssueCode,
} from '../../utils/payroll';

interface SettlementReviewPanelProps {
  drafts: EmployeeMonthlyCalculationDraft[];
  employees: Employee[];
  departments: Department[];
  reviewStates: SettlementReviewState[];
  isSettled: boolean;
  onOpenEmployeeCalendar: (employeeId: string) => void;
  onSaveReview: (input: SettlementReviewUpdateInput) => Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const reviewStatuses: SettlementReviewStatus[] = [
  'DRAFT',
  'NEEDS_REVIEW',
  'NEEDS_CORRECTION',
  'CHECKED',
];

export function SettlementReviewPanel({
  drafts,
  employees,
  departments,
  reviewStates,
  isSettled,
  onOpenEmployeeCalendar,
  onSaveReview,
}: SettlementReviewPanelProps) {
  const t = useTranslations();
  const [selectedItem, setSelectedItem] =
    useState<EmployeeSettlementReviewItem | null>(null);
  const reviewItems = useMemo(
    () => buildSettlementReviewItems({ drafts, reviewStates }),
    [drafts, reviewStates],
  );
  const summary = useMemo(
    () => calculateSettlementReviewSummary(reviewItems),
    [reviewItems],
  );
  const employeesById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <div>
              <Typography variant="h6">{t.settlement.review.title}</Typography>
              <Typography color="text.secondary">
                {t.settlement.review.description}
              </Typography>
            </div>
            <Chip
              icon={
                summary.readyForFutureExport ? (
                  <CheckCircleOutlineOutlined />
                ) : (
                  <ErrorOutlineOutlined />
                )
              }
              color={summary.readyForFutureExport ? 'success' : 'warning'}
              label={
                summary.readyForFutureExport
                  ? t.settlement.review.ready
                  : t.settlement.review.notReady
              }
            />
          </Stack>

          {isSettled ? (
            <Alert severity="info">{t.settlement.review.readOnly}</Alert>
          ) : null}

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <SummaryChip
              label={t.settlement.review.counters.total}
              value={summary.totalEmployees}
            />
            <SummaryChip
              label={t.settlement.review.counters.checked}
              value={summary.checkedEmployees}
              color={summary.checkedEmployees > 0 ? 'success' : 'default'}
            />
            <SummaryChip
              label={t.settlement.review.counters.correction}
              value={summary.requiresCorrectionEmployees}
              color={
                summary.requiresCorrectionEmployees > 0 ? 'error' : 'default'
              }
            />
            <SummaryChip
              label={t.settlement.review.counters.warnings}
              value={summary.employeesWithWarnings}
              color={summary.employeesWithWarnings > 0 ? 'warning' : 'default'}
            />
            <SummaryChip
              label={t.settlement.review.counters.unresolved}
              value={summary.employeesWithUnresolvedComponents}
              color={
                summary.employeesWithUnresolvedComponents > 0
                  ? 'error'
                  : 'default'
              }
            />
            <SummaryChip
              label={t.settlement.review.counters.notReviewed}
              value={summary.notReviewedEmployees}
              color={summary.notReviewedEmployees > 0 ? 'warning' : 'default'}
            />
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t.settlement.review.table.teta}</TableCell>
                  <TableCell>{t.settlement.review.table.employee}</TableCell>
                  <TableCell>{t.settlement.review.table.department}</TableCell>
                  <TableCell>{t.settlement.review.table.shift}</TableCell>
                  <TableCell>{t.settlement.review.table.status}</TableCell>
                  <TableCell align="right">
                    {t.settlement.review.table.warnings}
                  </TableCell>
                  <TableCell align="right">
                    {t.settlement.review.table.unresolved}
                  </TableCell>
                  <TableCell>{t.settlement.review.table.components}</TableCell>
                  <TableCell>{t.settlement.review.table.note}</TableCell>
                  <TableCell align="right">
                    {t.settlement.review.table.actions}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviewItems.map((item) => {
                  const employee = employeesById.get(item.draft.employeeId);
                  const employeeName = employee
                    ? `${employee.lastName} ${employee.firstName}`
                    : t.settlement.draft.table.unknownEmployee;
                  return (
                    <TableRow hover key={item.draft.employeeId}>
                      <TableCell>{item.draft.tetaNumber}</TableCell>
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
                      <TableCell>
                        <ReviewStatusChip status={item.effectiveStatus} />
                      </TableCell>
                      <TableCell align="right">{item.issues.length}</TableCell>
                      <TableCell align="right">
                        {item.unresolvedIssueCount}
                      </TableCell>
                      <TableCell>
                        {interpolate(t.settlement.review.components, {
                          brutto: currencyFormatter.format(
                            item.draft.totals.bruttoAdditions,
                          ),
                          netto: currencyFormatter.format(
                            item.draft.totals.nettoAllowances,
                          ),
                          deductions: currencyFormatter.format(
                            item.draft.totals.deductions,
                          ),
                        })}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          title={item.reviewState?.reviewNote ?? ''}
                        >
                          {item.reviewState?.reviewNote ||
                            t.settlement.review.table.noNote}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<FactCheckOutlined />}
                          onClick={() => setSelectedItem(item)}
                        >
                          {t.settlement.review.table.details}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </CardContent>

      {selectedItem ? (
        <SettlementReviewDetailsDialog
          item={selectedItem}
          employee={employeesById.get(selectedItem.draft.employeeId) ?? null}
          departmentsById={departmentsById}
          isSettled={isSettled}
          onClose={() => setSelectedItem(null)}
          onOpenEmployeeCalendar={() => {
            onOpenEmployeeCalendar(selectedItem.draft.employeeId);
            setSelectedItem(null);
          }}
          onSaveReview={onSaveReview}
        />
      ) : null}
    </Card>
  );
}

function SettlementReviewDetailsDialog({
  item,
  employee,
  departmentsById,
  isSettled,
  onClose,
  onOpenEmployeeCalendar,
  onSaveReview,
}: {
  item: EmployeeSettlementReviewItem;
  employee: Employee | null;
  departmentsById: Map<string, Department>;
  isSettled: boolean;
  onClose: () => void;
  onOpenEmployeeCalendar: () => void;
  onSaveReview: (input: SettlementReviewUpdateInput) => Promise<void>;
}) {
  const t = useTranslations();
  const [status, setStatus] = useState<SettlementReviewStatus>(
    item.effectiveStatus,
  );
  const [note, setNote] = useState(item.reviewState?.reviewNote ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const employeeName = employee
    ? `${employee.lastName} ${employee.firstName}`
    : t.settlement.draft.table.unknownEmployee;
  const groupedIssues = groupIssues(item.issues);
  const department = employee?.departmentId
    ? (departmentsById.get(employee.departmentId)?.name ??
      employee.departmentId)
    : t.organization.departments.unassigned;
  const shift = employee?.shiftAssignment
    ? t.organization.shifts[employee.shiftAssignment]
    : t.organization.shifts.unassigned;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await onSaveReview({
        employeeId: item.draft.employeeId,
        tetaNumber: item.draft.tetaNumber,
        reviewStatus: status,
        reviewNote: note,
      });
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t.settlement.review.details.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <div>
            <Typography variant="h6">
              {interpolate(t.settlement.review.details.employee, {
                employee: employeeName,
                teta: item.draft.tetaNumber,
              })}
            </Typography>
            <Typography color="text.secondary">
              {department} · {shift}
            </Typography>
          </div>

          {saveFailed ? (
            <Alert severity="error">
              {t.settlement.review.errors.saveFailed}
            </Alert>
          ) : null}

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <Button
              variant="outlined"
              startIcon={<OpenInNewOutlined />}
              onClick={onOpenEmployeeCalendar}
            >
              {t.settlement.review.actions.calendar}
            </Button>
            <Button
              component={RouterLink}
              to={routes.employees}
              variant="outlined"
              startIcon={<OpenInNewOutlined />}
            >
              {t.settlement.review.actions.employees}
            </Button>
            <Button
              component={RouterLink}
              to={routes.absences}
              variant="outlined"
              startIcon={<OpenInNewOutlined />}
            >
              {t.settlement.review.actions.absences}
            </Button>
            <Button
              component={RouterLink}
              to={routes.adjustments}
              variant="outlined"
              startIcon={<OpenInNewOutlined />}
            >
              {t.settlement.review.actions.adjustments}
            </Button>
            <Button
              component={RouterLink}
              to={routes.settings}
              variant="outlined"
              startIcon={<OpenInNewOutlined />}
            >
              {t.settlement.review.actions.settings}
            </Button>
          </Stack>

          <Divider />

          <ReviewSection title={t.settlement.review.details.workTime}>
            <Typography>
              {t.settlement.draft.table.nominal}:{' '}
              {formatHours(item.draft.totals.nominalHours)}
            </Typography>
            <Typography>
              {t.settlement.draft.table.worked}:{' '}
              {formatHours(item.draft.totals.workedHours)}
            </Typography>
            <Typography>
              {t.settlement.draft.table.virtual}:{' '}
              {formatHours(item.draft.attendance.virtualHours)}
            </Typography>
          </ReviewSection>

          <ReviewSection title={t.settlement.review.details.absences}>
            <Typography>
              L4: {formatHours(item.draft.absences.l4Hours)} · Urlop:{' '}
              {formatHours(item.draft.absences.vacationHours)} · Inne:{' '}
              {formatHours(item.draft.absences.otherAbsenceHours)}
            </Typography>
          </ReviewSection>

          <ReviewSection title={t.settlement.review.details.overtime}>
            <Typography>
              {t.settlement.draft.totals.privateTime}:{' '}
              {formatHours(item.draft.workTime.privateTimeHours)} ·{' '}
              {t.settlement.draft.totals.niedoczas}:{' '}
              {formatHours(item.draft.workTime.niedoczasHours)}
            </Typography>
            <Typography>
              {t.settlement.draft.totals.overtime50}:{' '}
              {formatHours(item.draft.workTime.paidOvertime50Hours)} ·{' '}
              {t.settlement.draft.totals.overtime100}:{' '}
              {formatHours(item.draft.workTime.paidOvertime100Hours)}
            </Typography>
          </ReviewSection>

          <ReviewSection title={t.settlement.review.details.components}>
            <Typography>
              {t.settlement.draft.totals.frequencyBonus}:{' '}
              {item.draft.totals.frequencyBonusAmount === null
                ? t.settlement.grid.empty
                : currencyFormatter.format(
                    item.draft.totals.frequencyBonusAmount,
                  )}
            </Typography>
            <Typography>
              {t.settlement.draft.totals.transportNetto}:{' '}
              {currencyFormatter.format(
                item.draft.components.transportAllowanceNetto,
              )}{' '}
              · {t.settlement.draft.totals.deductions}:{' '}
              {currencyFormatter.format(item.draft.totals.deductions)}
            </Typography>
          </ReviewSection>

          <ReviewSection title={t.settlement.review.details.adjustments}>
            <Typography>
              {t.settlement.draft.totals.increases}:{' '}
              {currencyFormatter.format(item.draft.totals.manualIncreases)} ·{' '}
              {t.settlement.draft.totals.decreases}:{' '}
              {currencyFormatter.format(item.draft.totals.manualDecreases)}
            </Typography>
          </ReviewSection>

          <ReviewSection title={t.settlement.review.details.warnings}>
            {item.issues.length === 0 ? (
              <Typography color="text.secondary">
                {t.settlement.review.details.noWarnings}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {[...groupedIssues.entries()].map(([group, issues]) => (
                  <Box key={group}>
                    <Typography variant="subtitle2">
                      {t.settlement.review.groups[group]}
                    </Typography>
                    <Stack spacing={0.5}>
                      {issues.map((issue, index) => (
                        <Typography
                          key={`${issue.code}:${issue.date ?? ''}:${index}`}
                          variant="body2"
                          color="warning.dark"
                        >
                          {issue.date ? `${issue.date}: ` : ''}
                          {issueMessage(issue.code, t)}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </ReviewSection>

          <TextField
            select
            label={t.settlement.review.table.status}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as SettlementReviewStatus)
            }
            disabled={isSettled}
          >
            {reviewStatuses.map((option) => (
              <MenuItem key={option} value={option}>
                {t.settlement.review.status[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t.settlement.review.details.reviewNote}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            multiline
            minRows={2}
            disabled={isSettled}
          />
          <Typography variant="caption" color="text.secondary">
            {item.reviewState?.reviewedAt
              ? interpolate(t.settlement.review.details.updatedBy, {
                  actor: item.reviewState.reviewedBy ?? '—',
                  date: dateTimeFormatter.format(item.reviewState.reviewedAt),
                })
              : t.settlement.review.details.notSaved}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.settlement.review.details.close}</Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={isSettled || isSaving}
        >
          {t.settlement.review.details.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SummaryChip({
  label,
  value,
  color = 'default',
}: {
  label: string;
  value: number;
  color?: 'default' | 'success' | 'warning' | 'error';
}) {
  return (
    <Chip
      variant="outlined"
      color={color}
      label={`${label}: ${value.toLocaleString('pl-PL')}`}
    />
  );
}

function ReviewStatusChip({ status }: { status: SettlementReviewStatus }) {
  const t = useTranslations();
  const color =
    status === 'CHECKED'
      ? 'success'
      : status === 'NEEDS_CORRECTION'
        ? 'error'
        : status === 'NEEDS_REVIEW'
          ? 'warning'
          : 'default';

  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      label={t.settlement.review.status[status]}
    />
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
        {title}
      </Typography>
      <Stack spacing={0.5}>{children}</Stack>
    </Box>
  );
}

function groupIssues(issues: SettlementReviewIssue[]) {
  return issues.reduce((groups, issue) => {
    const current = groups.get(issue.group) ?? [];
    current.push(issue);
    groups.set(issue.group, current);
    return groups;
  }, new Map<SettlementReviewIssue['group'], SettlementReviewIssue[]>());
}

function issueMessage(
  code: SettlementReviewIssueCode,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code in t.settlement.review.issues) {
    return t.settlement.review.issues[
      code as keyof typeof t.settlement.review.issues
    ];
  }
  return t.settlement.draft.warnings[
    code as keyof typeof t.settlement.draft.warnings
  ];
}

function formatHours(hours: number) {
  return interpolate('{{hours}} h', {
    hours: hours.toLocaleString('pl-PL'),
  });
}
