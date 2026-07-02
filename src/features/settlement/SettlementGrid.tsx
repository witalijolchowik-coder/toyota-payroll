import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  type SxProps,
  type Theme,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type { DailyValue, Employee } from '../../types/firestore';
import {
  dailyValueLookupKey,
  resolveSettlementCellValue,
  type CalendarDay,
} from './monthUtils';

interface SettlementGridProps {
  employees: Employee[];
  days: CalendarDay[];
  dailyValues: DailyValue[];
}

const weekdayFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  timeZone: 'UTC',
});

const tetaColumnWidth = 116;
const employeeColumnWidth = 210;

export function SettlementGrid({
  employees,
  days,
  dailyValues,
}: SettlementGridProps) {
  const t = useTranslations();
  const dailyValuesByEmployeeAndDate = new Map(
    dailyValues.map((value) => [
      dailyValueLookupKey(value.employeeId, value.date),
      value,
    ]),
  );

  return (
    <Card>
      <TableContainer>
        <Table
          size="small"
          sx={{
            minWidth: tetaColumnWidth + employeeColumnWidth + days.length * 56,
            tableLayout: 'fixed',
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                sx={leadingCellSx({
                  left: 0,
                  width: tetaColumnWidth,
                  zIndex: 4,
                })}
              >
                {t.settlement.grid.teta}
              </TableCell>
              <TableCell
                sx={leadingCellSx({
                  left: tetaColumnWidth,
                  width: employeeColumnWidth,
                  zIndex: 4,
                })}
              >
                {t.settlement.grid.employee}
              </TableCell>
              {days.map((day) => (
                <TableCell
                  key={day.isoDate}
                  align="center"
                  sx={{
                    width: 56,
                    minWidth: 56,
                    p: 0.75,
                    ...calendarBackground(day),
                  }}
                >
                  <Typography
                    variant="caption"
                    color={day.isFuture ? 'text.disabled' : 'text.secondary'}
                    sx={{ display: 'block', textTransform: 'capitalize' }}
                  >
                    {weekdayFormatter.format(day.date)}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    color={day.isFuture ? 'text.disabled' : 'text.primary'}
                  >
                    {day.dayOfMonth}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow hover key={employee.id}>
                <TableCell
                  sx={leadingCellSx({
                    left: 0,
                    width: tetaColumnWidth,
                    zIndex: 2,
                  })}
                >
                  <Typography variant="body2" sx={{ fontWeight: 750 }}>
                    {employee.tetaNumber}
                  </Typography>
                </TableCell>
                <TableCell
                  sx={leadingCellSx({
                    left: tetaColumnWidth,
                    width: employeeColumnWidth,
                    zIndex: 2,
                  })}
                >
                  <Typography variant="body2" noWrap>
                    {employee.firstName} {employee.lastName}
                  </Typography>
                </TableCell>
                {days.map((day) => {
                  const value = resolveSettlementCellValue({
                    employee,
                    day,
                    persistedValue: dailyValuesByEmployeeAndDate.get(
                      dailyValueLookupKey(employee.id, day.isoDate),
                    ),
                  });
                  const label =
                    value.hours === null
                      ? t.settlement.grid.empty
                      : interpolate(t.settlement.grid.hours, {
                          hours: value.hours.toLocaleString('pl-PL'),
                        });
                  const tooltip =
                    value.kind === 'virtual-default'
                      ? t.settlement.grid.virtualDefault
                      : value.kind === 'persisted'
                        ? t.settlement.grid.persistedValue
                        : '';

                  return (
                    <TableCell
                      key={day.isoDate}
                      align="center"
                      sx={{
                        width: 56,
                        minWidth: 56,
                        px: 0.5,
                        py: 1,
                        ...calendarBackground(day),
                      }}
                    >
                      {tooltip ? (
                        <Tooltip title={tooltip}>
                          <Box component="span" sx={cellValueSx(value.kind)}>
                            {label}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Box component="span" sx={cellValueSx(value.kind)}>
                          {label}
                        </Box>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function leadingCellSx({
  left,
  width,
  zIndex,
}: {
  left: number;
  width: number;
  zIndex: number;
}): SxProps<Theme> {
  return {
    position: 'sticky',
    left,
    width,
    minWidth: width,
    maxWidth: width,
    zIndex,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderRightColor: 'divider',
  };
}

function calendarBackground(day: CalendarDay): SxProps<Theme> {
  if (day.isFuture) {
    return { bgcolor: 'action.disabledBackground', color: 'text.disabled' };
  }
  if (day.isHoliday) {
    return {
      bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
    };
  }
  if (day.isWeekend) {
    return { bgcolor: 'action.hover' };
  }
  return { bgcolor: 'background.paper' };
}

function cellValueSx(
  kind: ReturnType<typeof resolveSettlementCellValue>['kind'],
): SxProps<Theme> {
  if (kind === 'virtual-default') {
    return { color: 'text.secondary', fontStyle: 'italic' };
  }
  if (kind === 'persisted') {
    return { color: 'text.primary', fontWeight: 700 };
  }
  return { color: 'text.disabled' };
}
