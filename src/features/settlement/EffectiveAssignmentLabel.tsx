import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Box, Stack, Tooltip, Typography } from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  Department,
  Employee,
  EmployeeAssignment,
  IsoDate,
} from '../../types/firestore';
import { resolveEffectiveAssignmentPresentation } from '../../utils/schedule';

interface EffectiveAssignmentLabelProps {
  employee: Employee;
  dates: readonly IsoDate[];
  assignments: readonly EmployeeAssignment[];
  departments: readonly Department[];
  showDepartment?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export function EffectiveAssignmentLabel({
  employee,
  dates,
  assignments,
  departments,
  showDepartment = false,
}: EffectiveAssignmentLabelProps) {
  const t = useTranslations();
  const presentation = resolveEffectiveAssignmentPresentation({
    employee,
    dates,
    assignments,
  });
  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const stableDepartment = presentation.departmentId
    ? (departmentNames.get(presentation.departmentId) ??
      presentation.departmentId)
    : t.organization.departments.unassigned;
  const shiftLabel =
    presentation.kind === 'VARIABLE'
      ? t.settlement.effectiveAssignment.variable
      : presentation.kind === 'MISSING_SHIFT'
        ? t.settlement.effectiveAssignment.missing
        : presentation.shiftAssignment
          ? t.organization.shifts[presentation.shiftAssignment]
          : t.settlement.effectiveAssignment.missing;
  const label =
    showDepartment && presentation.kind !== 'VARIABLE'
      ? interpolate(t.settlement.employeeCalendar.departmentAndShift, {
          department: stableDepartment,
          shift: shiftLabel,
        })
      : shiftLabel;

  const details = presentation.segments.map((segment) => {
    const department = segment.departmentId
      ? (departmentNames.get(segment.departmentId) ?? segment.departmentId)
      : t.organization.departments.unassigned;
    const shift = segment.shiftAssignment
      ? t.organization.shifts[segment.shiftAssignment]
      : t.settlement.effectiveAssignment.missing;
    return interpolate(t.settlement.effectiveAssignment.segment, {
      start: formatDate(segment.startDate),
      end: formatDate(segment.endDate),
      department,
      shift,
      source:
        segment.source === 'assignment-history'
          ? t.settlement.effectiveAssignment.historySource
          : t.settlement.effectiveAssignment.masterSource,
    });
  });

  return (
    <Tooltip
      arrow
      title={
        <Stack spacing={0.5}>
          {details.map((detail) => (
            <Typography key={detail} variant="caption">
              {detail}
            </Typography>
          ))}
          {presentation.hasMissingShift ? (
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {t.settlement.effectiveAssignment.missingWarning}
            </Typography>
          ) : null}
        </Stack>
      }
    >
      <Box
        component="span"
        sx={{
          alignItems: 'center',
          display: 'inline-flex',
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <Typography component="span" variant="caption" noWrap>
          {label}
        </Typography>
        {presentation.hasMissingShift ? (
          <WarningAmberOutlined
            aria-label={t.settlement.effectiveAssignment.missingWarning}
            color="warning"
            sx={{ flexShrink: 0, fontSize: 16 }}
          />
        ) : null}
      </Box>
    </Tooltip>
  );
}

function formatDate(date: IsoDate): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}
