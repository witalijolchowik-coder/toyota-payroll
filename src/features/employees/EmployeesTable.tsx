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
  hasCurrentStatusConflict,
  isEmployeeActiveOnDate,
} from '../../utils/payroll';

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
            <TableCell>{t.employees.table.teta}</TableCell>
            <TableCell>{t.employees.table.employee}</TableCell>
            <TableCell>{t.employees.table.identity}</TableCell>
            <TableCell>{t.employees.table.department}</TableCell>
            <TableCell>{t.employees.table.shiftAssignment}</TableCell>
            <TableCell>{t.employees.table.employmentPeriod}</TableCell>
            <TableCell>{t.employees.table.status}</TableCell>
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
                const currentlyActive = isEmployeeActiveOnDate(
                  employee,
                  new Date(),
                );
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
                      <Typography variant="body2" sx={{ fontWeight: 750 }}>
                        {employee.tetaNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{employeeName}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatIdentity(employee, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {employee.departmentId
                        ? (departmentsById.get(employee.departmentId)?.name ??
                          employee.departmentId)
                        : t.organization.departments.unassigned}
                    </TableCell>
                    <TableCell>
                      {employee.shiftAssignment
                        ? t.organization.shifts[employee.shiftAssignment]
                        : t.organization.shifts.unassigned}
                    </TableCell>
                    <TableCell>{formatEmploymentPeriod(employee, t)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          currentlyActive
                            ? t.employees.status.active
                            : t.employees.status.inactive
                        }
                        color={currentlyActive ? 'success' : 'default'}
                        variant={currentlyActive ? 'filled' : 'outlined'}
                      />
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

function formatEmploymentPeriod(
  employee: Employee,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!employee.employmentStartDate) {
    return t.employees.table.noStartDate;
  }

  const start = dateFormatter.format(employee.employmentStartDate);
  const end = employee.employmentEndDate
    ? dateFormatter.format(employee.employmentEndDate)
    : t.employees.table.noEndDate;
  return `${start} – ${end}`;
}
