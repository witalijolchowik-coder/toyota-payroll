import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import HouseOutlined from '@mui/icons-material/HouseOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import WorkHistoryOutlined from '@mui/icons-material/WorkHistoryOutlined';
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  Department,
  Employee,
  EmployeeEntitlement,
} from '../../types/firestore';
import {
  calculateFirstEmploymentLimit,
  calculateProjectedEmploymentLimit,
  formatPolishDate,
  requiresContractDecision,
  resolveCurrentEmploymentPeriod,
} from '../../utils/employees';
import { hasCurrentStatusConflict } from '../../utils/payroll';
import type {
  EmployeeListMode,
  EmployeeSortKey,
  EmployeeSortState,
} from './employeeTableModel';

interface EmployeesTableProps {
  employees: Employee[];
  departments: Department[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
  onContracts?: (employee: Employee) => void;
  entitlements: EmployeeEntitlement[];
  onAccommodation: (
    employee: Employee,
    currentAccommodation: EmployeeEntitlement | null,
  ) => void;
  mode: EmployeeListMode;
  sort: EmployeeSortState;
  onSort: (key: EmployeeSortKey) => void;
}

export function EmployeesTable({
  employees,
  departments,
  isLoading,
  onEdit,
  onDeactivate,
  onContracts,
  entitlements,
  onAccommodation,
  mode,
  sort,
  onSort,
}: EmployeesTableProps) {
  const t = useTranslations();
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );

  return (
    <TableContainer>
      <Table sx={{ minWidth: 1380 }}>
        <TableHead>
          <TableRow>
            <SortableHeader
              column="employee"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.employee}
            />
            <TableCell>{t.employees.table.phone}</TableCell>
            <TableCell>{t.employees.table.identity}</TableCell>
            <SortableHeader
              column="department"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.department}
            />
            <SortableHeader
              column="shift"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.shiftAssignment}
            />
            <SortableHeader
              column="firstEmployment"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.firstEmployment}
            />
            <SortableHeader
              column="currentContract"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.currentContract}
            />
            <TableCell align="right">{t.employees.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 8 }, (__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : employees.map((employee) => {
                const employeeName = `${employee.firstName} ${employee.lastName}`;
                const statusConflict = hasCurrentStatusConflict(
                  employee,
                  new Date(),
                );
                const today = new Date().toISOString().slice(0, 10);
                const currentAccommodation =
                  entitlements.find(
                    (item) =>
                      item.employeeId === employee.id &&
                      item.type === 'COMPANY_ACCOMMODATION' &&
                      item.status === 'ACTIVE' &&
                      item.validFrom <= today &&
                      (!item.validTo || item.validTo >= today),
                  ) ?? null;
                return (
                  <TableRow hover key={employee.id}>
                    <TableCell sx={{ minWidth: 235 }}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: 'center' }}
                      >
                        <Box
                          sx={{
                            position: 'relative',
                            width: 38,
                            height: 38,
                            flex: '0 0 auto',
                          }}
                        >
                          <Avatar
                            aria-hidden="true"
                            sx={{
                              width: 38,
                              height: 38,
                              fontSize: '0.78rem',
                              fontWeight: 750,
                              ...employeeAvatarColors(
                                employee.departmentId
                                  ? departmentsById.get(employee.departmentId)
                                      ?.name
                                  : null,
                              ),
                            }}
                          >
                            {employeeInitials(employee)}
                          </Avatar>
                          {employee.citizenship ? (
                            <Box
                              component="span"
                              aria-hidden="true"
                              sx={{
                                position: 'absolute',
                                right: -4,
                                bottom: -3,
                                display: 'grid',
                                placeItems: 'center',
                                width: 19,
                                height: 16,
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                border: '2px solid',
                                borderColor: 'background.paper',
                                fontSize: '0.72rem',
                                lineHeight: 1,
                                boxShadow: 1,
                              }}
                            >
                              {employee.citizenship === 'PL' ? '🇵🇱' : '🇺🇦'}
                            </Box>
                          ) : null}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 750, lineHeight: 1.25 }}
                          >
                            {employeeName}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.25 }}
                          >
                            {t.employees.table.tetaCompact}:{' '}
                            {employee.tetaNumber}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 145 }}>
                      <Typography
                        variant="body2"
                        color={
                          employee.phoneNumber
                            ? 'text.primary'
                            : 'text.secondary'
                        }
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {employee.phoneNumber ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 205 }}>
                      <EmployeeDocuments employee={employee} t={t} />
                    </TableCell>
                    <TableCell>
                      {departmentChip(
                        employee.departmentId
                          ? (departmentsById.get(employee.departmentId)?.name ??
                              employee.departmentId)
                          : t.organization.departments.unassigned,
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <ShiftIndicator shift={employee.shiftAssignment} t={t} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <FirstEmploymentCell employee={employee} t={t} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 190 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center' }}
                      >
                        <CurrentContractCell
                          employee={employee}
                          mode={mode}
                          t={t}
                        />
                        {statusConflict ? (
                          <Tooltip title={t.employees.table.statusConflict}>
                            <WarningAmberOutlined
                              color="warning"
                              fontSize="small"
                            />
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ justifyContent: 'flex-end' }}
                      >
                        <Tooltip title={t.employees.contracts.title}>
                          <IconButton
                            size="small"
                            aria-label={t.employees.contracts.title}
                            onClick={() => onContracts?.(employee)}
                            sx={actionButtonSx}
                          >
                            <WorkHistoryOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            currentAccommodation
                              ? t.employees.accommodation.companyActive
                              : t.employees.accommodation.companyInactive
                          }
                        >
                          <IconButton
                            size="small"
                            aria-label={
                              currentAccommodation
                                ? t.employees.accommodation.companyActive
                                : t.employees.accommodation.companyInactive
                            }
                            onClick={() =>
                              onAccommodation(employee, currentAccommodation)
                            }
                            sx={actionButtonSx}
                          >
                            {currentAccommodation ? (
                              <HomeWorkOutlined
                                fontSize="small"
                                color="primary"
                              />
                            ) : (
                              <HouseOutlined fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={interpolate(t.employees.table.edit, {
                            name: employeeName,
                          })}
                        >
                          <IconButton
                            size="small"
                            aria-label={interpolate(t.employees.table.edit, {
                              name: employeeName,
                            })}
                            onClick={() => onEdit(employee)}
                            sx={actionButtonSx}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {employee.isActive ? (
                          <Tooltip
                            title={interpolate(t.employees.table.deactivate, {
                              name: employeeName,
                            })}
                          >
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={interpolate(
                                t.employees.table.deactivate,
                                { name: employeeName },
                              )}
                              onClick={() => onDeactivate(employee)}
                              sx={actionButtonSx}
                            >
                              <PersonOffOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SortableHeader({
  column,
  sort,
  onSort,
  label,
}: {
  column: EmployeeSortKey;
  sort: EmployeeSortState;
  onSort: (key: EmployeeSortKey) => void;
  label: string;
}) {
  const active = sort.key === column;
  return (
    <TableCell sortDirection={active ? sort.direction : false}>
      <TableSortLabel
        active={active}
        direction={active ? sort.direction : 'asc'}
        onClick={() => onSort(column)}
        aria-label={label}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

const departmentStyles: Record<string, { bg: string; color: string }> = {
  Metal: { bg: '#dbeafe', color: '#1e3a8a' },
  Szwalnia: { bg: '#fce7f3', color: '#831843' },
  Montaż: { bg: '#dcfce7', color: '#14532d' },
  PU: { bg: '#fef3c7', color: '#78350f' },
  Headliner: { bg: '#ede9fe', color: '#4c1d95' },
  Magazyn: { bg: '#e5e7eb', color: '#1f2937' },
};

function departmentChip(label: string) {
  const style = departmentStyles[label] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <Chip
      size="small"
      label={label}
      sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700 }}
    />
  );
}

function EmployeeDocuments({
  employee,
  t,
}: {
  employee: Employee;
  t: ReturnType<typeof useTranslations>;
}) {
  const documents = [
    employee.pesel
      ? {
          icon: <BadgeOutlined fontSize="inherit" />,
          label: `${t.employees.table.pesel}: ${employee.pesel}`,
        }
      : null,
    employee.passportNumber
      ? {
          icon: <DescriptionOutlined fontSize="inherit" />,
          label: `${t.employees.table.passport}: ${employee.passportNumber}`,
        }
      : null,
    employee.foreignDocumentNumber
      ? {
          icon: <DescriptionOutlined fontSize="inherit" />,
          label: `${t.employees.table.foreignDocument}: ${employee.foreignDocumentNumber}`,
        }
      : null,
  ].filter((document) => document !== null);

  if (documents.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t.employees.table.noIdentity}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35}>
      {documents.map((document) => (
        <Stack
          key={document.label}
          direction="row"
          spacing={0.7}
          sx={{ alignItems: 'center' }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              color: 'text.secondary',
              fontSize: '1rem',
            }}
          >
            {document.icon}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {document.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function ShiftIndicator({
  shift,
  t,
}: {
  shift: Employee['shiftAssignment'];
  t: ReturnType<typeof useTranslations>;
}) {
  const color = shift
    ? { RED: '#d2101e', WHITE: '#64748b', BLUE: '#2e90fa' }[shift]
    : '#98a2b3';
  const label = shift
    ? t.employees.table.shiftShort[shift]
    : t.organization.shifts.unassigned;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box
        aria-hidden="true"
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }}
      />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function FirstEmploymentCell({
  employee,
  t,
}: {
  employee: Employee;
  t: ReturnType<typeof useTranslations>;
}) {
  const sourceDate = employee.firstToyotaEmploymentDate;
  const limit =
    calculateProjectedEmploymentLimit(employee) ??
    calculateFirstEmploymentLimit(sourceDate);

  if (!sourceDate || !limit) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t.employees.table.noFirstToyotaDate}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.25}>
      <Typography
        variant="body2"
        sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}
      >
        {formatPolishDate(sourceDate)}
      </Typography>
      <Typography
        variant="caption"
        data-testid={`first-employment-limit-${employee.id}`}
        sx={{
          color: (theme) =>
            theme.palette.mode === 'light' ? '#8f2d3f' : '#f3a6b5',
          fontWeight: 650,
          whiteSpace: 'nowrap',
        }}
      >
        {t.employees.table.limit}: {formatPolishDate(limit)}
      </Typography>
    </Stack>
  );
}

function CurrentContractCell({
  employee,
  mode,
  t,
}: {
  employee: Employee;
  mode: EmployeeListMode;
  t: ReturnType<typeof useTranslations>;
}) {
  const period = resolveCurrentEmploymentPeriod(employee);
  const overdue = requiresContractDecision(employee);

  if (!period) {
    return (
      <Typography variant="body2" color="text.secondary">
        {mode === 'active'
          ? t.employees.table.noCurrentContract
          : t.employees.table.noArchivedContract}
      </Typography>
    );
  }

  return (
    <Stack spacing={0.25}>
      {overdue ? (
        <Typography
          variant="caption"
          color="error.main"
          sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}
        >
          {t.employees.table.contractOverdue}
        </Typography>
      ) : null}
      <ContractDateLine
        label={t.employees.table.contractFrom}
        value={formatPolishDate(period.startDate)}
      />
      <ContractDateLine
        label={t.employees.table.contractTo}
        value={
          period.endDate
            ? formatPolishDate(period.endDate)
            : t.employees.table.openEndedContract
        }
      />
      {overdue ? (
        <Typography variant="caption" color="error.main">
          {t.employees.contracts.decisionRequired}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ContractDateLine({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
      <Box component="span" color="text.secondary">
        {label}:{' '}
      </Box>
      <Box component="span" sx={{ fontWeight: 650 }}>
        {value}
      </Box>
    </Typography>
  );
}

function employeeInitials(employee: Employee): string {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

function employeeAvatarColors(departmentName?: string | null) {
  const style = departmentName ? departmentStyles[departmentName] : undefined;
  return style
    ? { bgcolor: style.bg, color: style.color }
    : { bgcolor: '#f2f4f7', color: '#475467' };
}

const actionButtonSx = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  '&:hover': {
    borderColor: 'currentColor',
  },
} as const;
