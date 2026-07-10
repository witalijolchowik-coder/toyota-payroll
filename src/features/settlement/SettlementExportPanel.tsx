import { useMemo } from 'react';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  DailyValue,
  Department,
  Employee,
  MonthId,
  SettlementReviewState,
} from '../../types/firestore';
import {
  buildSettlementReviewItems,
  calculateMonthNominalHours,
  type EmployeeMonthlyCalculationDraft,
} from '../../utils/payroll';
import {
  prepareSettlementExportPackage,
  type ExportReadinessWarningCode,
} from '../../utils/reports';
import {
  dailyValueLookupKey,
  resolveSettlementCellValue,
  type CalendarDay,
} from './monthUtils';

interface SettlementExportPanelProps {
  monthId: MonthId;
  employees: Employee[];
  departments: Department[];
  days: CalendarDay[];
  dailyValues: DailyValue[];
  drafts: EmployeeMonthlyCalculationDraft[];
  reviewStates: SettlementReviewState[];
  publicHolidays: ReadonlySet<string>;
}

export function SettlementExportPanel({
  monthId,
  employees,
  departments,
  days,
  dailyValues,
  drafts,
  reviewStates,
  publicHolidays,
}: SettlementExportPanelProps) {
  const t = useTranslations();
  const exportPackage = useMemo(() => {
    const departmentsById = new Map(
      departments.map((department) => [department.id, department]),
    );
    const dailyValuesByEmployeeAndDate = new Map(
      dailyValues.map((value) => [
        dailyValueLookupKey(value.employeeId, value.date),
        value,
      ]),
    );
    const reviewItems = buildSettlementReviewItems({ drafts, reviewStates });
    const reviewItemsByEmployeeId = new Map(
      reviewItems.map((item) => [item.draft.employeeId, item]),
    );
    const employeesById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );
    const records = drafts.flatMap((draft) => {
      const employee = employeesById.get(draft.employeeId);
      if (!employee) {
        return [];
      }
      const reviewItem = reviewItemsByEmployeeId.get(employee.id);
      return [
        {
          employee,
          departmentName: employee.departmentId
            ? departmentsById.get(employee.departmentId)?.name
            : null,
          identity: {
            pesel: employee.pesel,
            passport: employee.passportNumber,
            foreignDocument: employee.foreignDocumentNumber,
          },
          draft,
          reviewStatus: reviewItem?.effectiveStatus,
          unresolvedIssueCount: reviewItem?.unresolvedIssueCount ?? 0,
          dailyCells: days.map((day) => {
            const value = resolveSettlementCellValue({
              employee,
              day,
              persistedValue: dailyValuesByEmployeeAndDate.get(
                dailyValueLookupKey(employee.id, day.isoDate),
              ),
            });
            return {
              dayOfMonth: day.dayOfMonth,
              hours: value.hours,
            };
          }),
        },
      ];
    });

    return prepareSettlementExportPackage({
      monthId,
      records,
      monthNominalHours: calculateMonthNominalHours(monthId, {
        publicHolidays,
      }),
    });
  }, [
    dailyValues,
    days,
    departments,
    drafts,
    employees,
    monthId,
    publicHolidays,
    reviewStates,
  ]);
  const warningCounts = countWarnings(exportPackage.warnings);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
            }}
          >
            <div>
              <Typography variant="h6">{t.settlement.export.title}</Typography>
              <Typography color="text.secondary">
                {t.settlement.export.description}
              </Typography>
            </div>
            <Chip
              color={
                exportPackage.warnings.length === 0 ? 'success' : 'warning'
              }
              variant="outlined"
              label={
                exportPackage.warnings.length === 0
                  ? t.settlement.export.ready
                  : interpolate(t.settlement.export.warningCount, {
                      count: exportPackage.warnings.length.toString(),
                    })
              }
            />
          </Stack>

          {exportPackage.warnings.length > 0 ? (
            <Alert severity="warning">
              <Stack spacing={0.5}>
                {Object.entries(warningCounts).map(([code, count]) => (
                  <Typography key={code} variant="body2">
                    {interpolate(
                      t.settlement.export.warnings[
                        code as ExportReadinessWarningCode
                      ],
                      { count: count.toString() },
                    )}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          ) : null}

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <Button
              variant="contained"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                downloadTextFile(
                  exportPackage.toyota.fileName,
                  exportPackage.toyota.excelXml,
                  'application/vnd.ms-excel;charset=utf-8',
                )
              }
            >
              {t.settlement.export.downloadToyota}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                downloadTextFile(
                  exportPackage.soz.plFileName,
                  exportPackage.soz.polishCsv,
                  'text/csv;charset=utf-8',
                )
              }
            >
              {t.settlement.export.downloadSozPl}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                downloadTextFile(
                  exportPackage.soz.foreignFileName,
                  exportPackage.soz.foreignCsv,
                  'text/csv;charset=utf-8',
                )
              }
            >
              {t.settlement.export.downloadSozForeign}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                downloadTextFile(
                  exportPackage.soz.noteFileName,
                  exportPackage.soz.note,
                  'text/plain;charset=utf-8',
                )
              }
            >
              {t.settlement.export.downloadNote}
            </Button>
          </Stack>

          <Divider />

          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap' }}
          >
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.export.counters.toyota, {
                count: exportPackage.toyota.rows.length.toString(),
              })}
            />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.export.counters.sozPl, {
                count: exportPackage.soz.polishRows.length.toString(),
              })}
            />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.export.counters.sozForeign, {
                count: exportPackage.soz.foreignRows.length.toString(),
              })}
            />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.export.counters.note, {
                count: exportPackage.soz.noteEntries.length.toString(),
              })}
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {t.settlement.export.identityLimitation}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function countWarnings(warnings: { code: ExportReadinessWarningCode }[]) {
  return warnings.reduce(
    (counts, warning) => ({
      ...counts,
      [warning.code]: (counts[warning.code] ?? 0) + 1,
    }),
    {} as Partial<Record<ExportReadinessWarningCode, number>>,
  );
}

function downloadTextFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
