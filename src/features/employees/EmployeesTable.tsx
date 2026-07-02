import EditOutlined from '@mui/icons-material/EditOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
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
import type { Employee } from '../../types/firestore';

interface EmployeesTableProps {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function EmployeesTable({
  employees,
  isLoading,
  onEdit,
  onDeactivate,
}: EmployeesTableProps) {
  const t = useTranslations();

  return (
    <TableContainer>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t.employees.table.teta}</TableCell>
            <TableCell>{t.employees.table.employee}</TableCell>
            <TableCell>{t.employees.table.employmentPeriod}</TableCell>
            <TableCell>{t.employees.table.status}</TableCell>
            <TableCell align="right">{t.employees.table.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 5 }, (__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : employees.map((employee) => {
                const employeeName = `${employee.firstName} ${employee.lastName}`;
                return (
                  <TableRow hover key={employee.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 750 }}>
                        {employee.tetaNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{employeeName}</TableCell>
                    <TableCell>{formatEmploymentPeriod(employee, t)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          employee.isActive
                            ? t.employees.status.active
                            : t.employees.status.inactive
                        }
                        color={employee.isActive ? 'success' : 'default'}
                        variant={employee.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ justifyContent: 'flex-end' }}
                      >
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
