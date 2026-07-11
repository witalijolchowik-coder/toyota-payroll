import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import {
  applyL4ImportRows,
  loadL4ImportPreview,
} from '../../services/absencesService';
import type { L4ImportApplyResult } from '../../services/absencesService';
import {
  parseL4ReportWorkbook,
  type L4ImportPreviewRow,
} from '../../utils/absences';

interface L4ImportDialogProps {
  onClose: () => void;
  onImported: () => Promise<void>;
}

const statusColor: Record<
  L4ImportPreviewRow['status'],
  'success' | 'warning' | 'error' | 'info' | 'default'
> = {
  ready: 'success',
  duplicate: 'default',
  'overlap-review': 'warning',
  'continuation-review': 'warning',
  unmatched: 'error',
  ambiguous: 'warning',
  invalid: 'error',
  'unsupported-type': 'error',
  'month-missing': 'warning',
};

export function L4ImportDialog({ onClose, onImported }: L4ImportDialogProps) {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<L4ImportPreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<L4ImportApplyResult | null>(null);

  const createCount = useMemo(
    () => rows.filter((row) => row.status === 'ready').length,
    [rows],
  );

  const handleAnalyze = async () => {
    if (!file) {
      setError(t.absences.l4Import.errors.fileRequired);
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const sourceRows = parseL4ReportWorkbook(buffer);
      setRows(await loadL4ImportPreview(sourceRows));
    } catch {
      setRows([]);
      setError(t.absences.l4Import.errors.analyzeFailed);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!file || createCount === 0) {
      return;
    }
    setIsApplying(true);
    setError(null);
    try {
      const applyResult = await applyL4ImportRows({
        rows,
        fileName: file.name,
      });
      setResult(applyResult);
      await onImported();
    } catch {
      setError(t.absences.l4Import.errors.applyFailed);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="xl"
      onClose={isApplying ? undefined : onClose}
    >
      <DialogTitle>{t.absences.l4Import.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            {t.absences.l4Import.description}
          </Typography>
          <Alert severity="info">{t.absences.l4Import.expectedFormat}</Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component="label" variant="outlined">
              {t.absences.l4Import.chooseFile}
              <input
                hidden
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRows([]);
                  setResult(null);
                  setError(null);
                }}
              />
            </Button>
            <Box sx={{ alignSelf: 'center' }}>
              <Typography color="text.secondary" variant="body2">
                {file?.name ?? t.absences.l4Import.noFile}
              </Typography>
            </Box>
            <Button
              variant="contained"
              disabled={!file || isAnalyzing}
              onClick={() => void handleAnalyze()}
            >
              {isAnalyzing
                ? t.absences.l4Import.analyzing
                : t.absences.l4Import.analyze}
            </Button>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {result ? (
            <Alert severity="success">
              {interpolate(t.absences.l4Import.result, {
                created: String(result.created),
                skipped: String(result.skipped),
                failed: String(result.failed),
              })}
            </Alert>
          ) : null}

          {rows.length > 0 ? (
            <>
              <Divider />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'center' } }}
              >
                <Typography sx={{ fontWeight: 650 }}>
                  {interpolate(t.absences.l4Import.summary, {
                    total: String(rows.length),
                    create: String(createCount),
                  })}
                </Typography>
                <Chip
                  color={createCount > 0 ? 'success' : 'default'}
                  label={interpolate(t.absences.l4Import.toCreate, {
                    count: String(createCount),
                  })}
                />
              </Stack>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t.absences.l4Import.table.row}</TableCell>
                      <TableCell>
                        {t.absences.l4Import.table.sourceName}
                      </TableCell>
                      <TableCell>
                        {t.absences.l4Import.table.employee}
                      </TableCell>
                      <TableCell>{t.absences.l4Import.table.teta}</TableCell>
                      <TableCell>{t.absences.l4Import.table.type}</TableCell>
                      <TableCell>{t.absences.l4Import.table.period}</TableCell>
                      <TableCell>
                        {t.absences.l4Import.table.ownerMonth}
                      </TableCell>
                      <TableCell>{t.absences.l4Import.table.status}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.sourceName || t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          {row.matchedEmployeeName ?? t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          {row.tetaNumber ?? t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          {row.absenceType || t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          {row.startDate ?? t.absences.l4Import.empty} –{' '}
                          {row.endDate ?? t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          {row.ownerMonthId ?? t.absences.l4Import.empty}
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.5}>
                            <Chip
                              size="small"
                              color={statusColor[row.status]}
                              label={t.absences.l4Import.status[row.status]}
                            />
                            <Typography
                              color="text.secondary"
                              variant="caption"
                            >
                              {messageLabel(
                                t.absences.l4Import.messages,
                                row.message,
                              )}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isApplying}>
          {t.absences.l4Import.close}
        </Button>
        <Button
          variant="contained"
          disabled={createCount === 0 || isApplying}
          onClick={() => void handleApply()}
        >
          {isApplying
            ? t.absences.l4Import.applying
            : interpolate(t.absences.l4Import.apply, {
                count: String(createCount),
              })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function messageLabel(labels: Record<string, string>, message: string): string {
  return labels[message] ?? message;
}
