import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import HouseOutlined from '@mui/icons-material/HouseOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import {
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
  entitlements: EmployeeEntitlement[];
  onAccommodation: (
    employee: Employee,
    currentAccommodation: EmployeeEntitlement | null,
  ) => void;
  mode: EmployeeListMode;
  sort: EmployeeSortState;
  onSort: (key: EmployeeSortKey) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function EmployeesTable({
  employees,
  departments,
  isLoading,
  onEdit,
  onDeactivate,
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
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <SortableHeader
              column="teta"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.teta}
            />
            <SortableHeader
              column="employee"
              sort={sort}
              onSort={onSort}
              label={t.employees.table.employee}
            />
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
              column="employment"
              sort={sort}
              onSort={onSort}
              label={
                mode === 'active'
                  ? t.employees.table.activeEmploymentDates
                  : t.employees.table.archiveEmploymentDates
              }
            />
            <TableCell align="right">{t.employees.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }, (__, cellIndex) => (
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
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 400 }}>
                        {employee.tetaNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 750 }}>
                        {employeeName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatIdentity(employee, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {departmentChip(
                        employee.departmentId
                          ? (departmentsById.get(employee.departmentId)?.name ??
                              employee.departmentId)
                          : t.organization.departments.unassigned,
                      )}
                    </TableCell>
                    <TableCell>
                      {shiftChip(employee.shiftAssignment, t)}
                    </TableCell>
                    <TableCell>
                      {formatEmploymentDates(employee, mode, t)}
                      {statusConflict ? (
                        <Tooltip title={t.employees.table.statusConflict}>
                          <WarningAmberOutlined
                            color="warning"
                            fontSize="small"
                            sx={{ ml: 1 }}
                          />
                        </Tooltip>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ justifyContent: 'flex-end' }}
                      >
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

function formatIdentity(
  employee: Employee,
  t: ReturnType<typeof useTranslations>,
): string {
  const values = [
    employee.pesel ? `${t.employees.table.pesel}: ${employee.pesel}` : null,
    employee.passportNumber
      ? `${t.employees.table.passport}: ${employee.passportNumber}`
      : null,
    employee.foreignDocumentNumber
      ? `${t.employees.table.foreignDocument}: ${employee.foreignDocumentNumber}`
      : null,
  ].filter(Boolean);

  return values.length > 0 ? values.join(' · ') : t.employees.table.noIdentity;
}

function formatEmploymentDates(
  employee: Employee,
  mode: EmployeeListMode,
  t: ReturnType<typeof useTranslations>,
): string {
  const first = employee.firstToyotaEmploymentDate
    ? dateFormatter.format(employee.firstToyotaEmploymentDate)
    : t.employees.table.noFirstToyotaDate;
  const second =
    mode === 'active'
      ? employee.employmentStartDate
      : employee.employmentEndDate;
  const fallback =
    mode === 'active'
      ? t.employees.table.noStartDate
      : t.employees.table.noFinalEndDate;
  return `${first} / ${second ? dateFormatter.format(second) : fallback}`;
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

function shiftChip(
  shift: Employee['shiftAssignment'],
  t: ReturnType<typeof useTranslations>,
) {
  if (!shift)
    return (
      <Chip
        size="small"
        variant="outlined"
        label={t.organization.shifts.unassigned}
      />
    );
  const label = t.employees.table.shiftShort[shift];
  const styles = {
    RED: { bgcolor: '#fee2e2', color: '#991b1b' },
    WHITE: {
      bgcolor: '#ffffff',
      color: '#374151',
      border: '1px solid #9ca3af',
    },
    BLUE: { bgcolor: '#dbeafe', color: '#1e3a8a' },
  } as const;
  return (
    <Chip
      size="small"
      label={label}
      sx={{ ...styles[shift], fontWeight: 700 }}
    />
  );
}
