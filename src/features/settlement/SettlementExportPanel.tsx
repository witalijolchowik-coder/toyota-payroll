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
import { auth } from '../../config/firebase';
import { recordAuditEntry } from '../../services/auditService';
import { firestorePaths } from '../../services/firestore/paths';
import {
  renderAbsenceWorkbook,
  type ExportReadinessWarningCode,
} from '../../utils/reports';
import type { SettlementVersionArtifact } from '../../services/settlementVersionService';
import {
  buildSettlementExportPackageForMonth,
  type SettlementExportBuildInput,
} from './settlementExportBuilder';

interface SettlementExportPanelProps extends SettlementExportBuildInput {
  finalArtifacts?: SettlementVersionArtifact[] | null;
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
  mode = 'preview',
  finalArtifacts = null,
}: SettlementExportPanelProps) {
  const t = useTranslations();
  const exportPackage = useMemo(
    () =>
      buildSettlementExportPackageForMonth({
        monthId,
        employees,
        departments,
        days,
        dailyValues,
        drafts,
        reviewStates,
        publicHolidays,
        mode,
      }),
    [
      dailyValues,
      days,
      departments,
      drafts,
      employees,
      monthId,
      publicHolidays,
      reviewStates,
      mode,
    ],
  );
  const blockerCounts = countWarnings(
    exportPackage.warnings.filter((warning) => warning.severity === 'BLOCKER'),
  );
  const warningCounts = countWarnings(
    exportPackage.warnings.filter((warning) => warning.severity === 'WARNING'),
  );

  if (finalArtifacts) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">
              Finalny pakiet zamkniętej wersji
            </Typography>
            <Alert severity="success">
              Pliki poniżej są zapisanymi artefaktami wersji zamkniętej i nie są
              generowane ponownie.
            </Alert>
            <Stack
              direction="row"
              useFlexGap
              spacing={1}
              sx={{ flexWrap: 'wrap' }}
            >
              {finalArtifacts.map((artifact) => (
                <Button
                  key={artifact.id}
                  variant="outlined"
                  startIcon={<DownloadOutlined />}
                  onClick={() =>
                    downloadBinaryFile(
                      artifact.fileName,
                      artifact.content,
                      artifact.mimeType,
                    )
                  }
                >
                  {artifact.fileName}
                </Button>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }
  const runExport = (outputType: string, download: () => void) => {
    const actorUid = auth?.currentUser?.uid;
    if (actorUid) {
      void recordAuditEntry({
        entityPath: firestorePaths.month(monthId),
        action: 'create',
        actorUid,
        changes: {
          operation:
            exportPackage.warnings.length > 0
              ? 'unfinished-export-generated'
              : 'completed-export-generated',
          month_id: monthId,
          output_type: outputType,
          blocker_count: exportPackage.warnings.length,
        },
      });
    }
    download();
  };

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
                Object.keys(blockerCounts).length
                  ? 'error'
                  : exportPackage.warnings.length === 0
                    ? 'success'
                    : 'warning'
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

          {Object.keys(blockerCounts).length > 0 ? (
            <Alert severity="error">
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  BLOCKER
                </Typography>
                {Object.entries(blockerCounts).map(([code, count]) => (
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

          {Object.keys(warningCounts).length > 0 ? (
            <Alert severity="warning">
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  WARNING
                </Typography>
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
                runExport('toyota-xlsx', () =>
                  downloadBinaryFile(
                    exportPackage.toyota.fileName,
                    exportPackage.toyota.workbook,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  ),
                )
              }
            >
              {exportPackage.warnings.length > 0
                ? t.settlement.export.downloadIncomplete
                : t.settlement.export.downloadToyota}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                runExport('soz-pl-csv', () =>
                  downloadTextFile(
                    exportPackage.soz.plFileName,
                    exportPackage.soz.polishCsv,
                    'text/csv;charset=utf-8',
                  ),
                )
              }
            >
              {t.settlement.export.downloadSozPl}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                runExport('soz-foreign-csv', () =>
                  downloadTextFile(
                    exportPackage.soz.foreignFileName,
                    exportPackage.soz.foreignCsv,
                    'text/csv;charset=utf-8',
                  ),
                )
              }
            >
              {t.settlement.export.downloadSozForeign}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                runExport('absence-pl-xlsx', () => {
                  void renderAbsenceWorkbook(
                    exportPackage.absences.polishRows,
                    monthId,
                  ).then((workbook) =>
                    downloadBinaryFile(
                      exportPackage.absences.plFileName,
                      workbook,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ),
                  );
                })
              }
            >
              {t.settlement.export.downloadAbsencePl}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                runExport('absence-foreign-xlsx', () => {
                  void renderAbsenceWorkbook(
                    exportPackage.absences.foreignRows,
                    monthId,
                  ).then((workbook) =>
                    downloadBinaryFile(
                      exportPackage.absences.foreignFileName,
                      workbook,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ),
                  );
                })
              }
            >
              {t.settlement.export.downloadAbsenceForeign}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              onClick={() =>
                runExport('soz-compensation-note', () =>
                  downloadTextFile(
                    exportPackage.soz.noteFileName,
                    exportPackage.soz.note,
                    'text/plain;charset=utf-8',
                  ),
                )
              }
            >
              {t.settlement.export.downloadNote}
            </Button>
            {exportPackage.soz.polishCompensationWorkbook &&
            exportPackage.soz.polishCompensationFileName ? (
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={() =>
                  runExport('underwork-compensation-pl', () =>
                    downloadBinaryFile(
                      exportPackage.soz.polishCompensationFileName!,
                      exportPackage.soz.polishCompensationWorkbook!,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ),
                  )
                }
              >
                {t.settlement.export.downloadCompensationPl}
              </Button>
            ) : null}
            {exportPackage.soz.foreignCompensationWorkbook &&
            exportPackage.soz.foreignCompensationFileName ? (
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={() =>
                  runExport('underwork-compensation-foreign', () =>
                    downloadBinaryFile(
                      exportPackage.soz.foreignCompensationFileName!,
                      exportPackage.soz.foreignCompensationWorkbook!,
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    ),
                  )
                }
              >
                {t.settlement.export.downloadCompensationForeign}
              </Button>
            ) : null}
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
              label={interpolate(t.settlement.export.counters.absencePl, {
                count: exportPackage.absences.polishRows.length.toString(),
              })}
            />
            <Chip
              variant="outlined"
              label={interpolate(t.settlement.export.counters.absenceForeign, {
                count: exportPackage.absences.foreignRows.length.toString(),
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

function downloadBinaryFile(
  fileName: string,
  content: Uint8Array,
  type: string,
) {
  const bytes = new Uint8Array(content);
  const blob = new Blob([bytes.buffer], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
