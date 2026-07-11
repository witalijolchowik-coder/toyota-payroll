import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import type {
  Department,
  Employee,
  PayrollSetting,
} from '../../types/firestore';
import {
  buildEmployeeImportPreview,
  formatImportDate,
  parseSozRowsFromCsv,
  parseToyotaEmployeeRowsFromMatrix,
  type EmployeeImportPreviewRow,
  type EmployeeImportStatus,
  type EmployeeImportWarningCode,
} from './employeeImport';

interface EmployeeImportDialogProps {
  employees: Employee[];
  departments: Department[];
  accommodationVariants: PayrollSetting[];
  onClose: () => void;
  onImport: (rows: EmployeeImportPreviewRow[]) => Promise<void>;
}

const statusColors: Record<
  EmployeeImportStatus,
  'success' | 'info' | 'warning' | 'error' | 'default'
> = {
  new: 'success',
  existing: 'info',
  duplicate: 'warning',
  conflict: 'error',
  blocked: 'default',
};

const amountFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function EmployeeImportDialog({
  employees,
  departments,
  accommodationVariants,
  onClose,
  onImport,
}: EmployeeImportDialogProps) {
  const t = useTranslations();
  const [toyotaFile, setToyotaFile] = useState<File | null>(null);
  const [sozPlFile, setSozPlFile] = useState<File | null>(null);
  const [sozUaFile, setSozUaFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<EmployeeImportPreviewRow[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectableRows = useMemo(
    () => previewRows.filter((row) => row.status === 'new' && row.createInput),
    [previewRows],
  );
  const selectedRows = useMemo(
    () => previewRows.filter((row) => selectedIds.has(row.id)),
    [previewRows, selectedIds],
  );

  const analyzeFiles = async () => {
    if (!toyotaFile) {
      setError(t.employees.import.errors.toyotaRequired);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const toyotaRows = await readToyotaRows(toyotaFile);
      const [sozPlRows, sozUaRows] = await Promise.all([
        sozPlFile ? readSozRows(sozPlFile, 'soz-pl') : Promise.resolve([]),
        sozUaFile ? readSozRows(sozUaFile, 'soz-ua') : Promise.resolve([]),
      ]);
      const rows = buildEmployeeImportPreview({
        toyotaRows,
        sozRows: [...sozPlRows, ...sozUaRows],
        existingEmployees: employees,
        departments,
        accommodationVariants,
      });
      setPreviewRows(rows);
      setSelectedIds(
        new Set(
          rows
            .filter((row) => row.status === 'new' && row.createInput)
            .map((row) => row.id),
        ),
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.import.errors.analyzeFailed);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitImport = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onImport(selectedRows);
      onClose();
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.import.errors.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <Dialog open fullWidth maxWidth="xl" onClose={onClose}>
      <DialogTitle>{t.employees.import.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t.employees.import.description}
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FilePicker
              label={t.employees.import.files.toyota}
              file={toyotaFile}
              accept=".xlsx,.xls"
              onChange={setToyotaFile}
            />
            <FilePicker
              label={t.employees.import.files.sozPl}
              file={sozPlFile}
              accept=".csv,text/csv"
              onChange={setSozPlFile}
            />
            <FilePicker
              label={t.employees.import.files.sozUa}
              file={sozUaFile}
              accept=".csv,text/csv"
              onChange={setSozUaFile}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Button
              variant="contained"
              onClick={() => void analyzeFiles()}
              disabled={isAnalyzing || isSubmitting}
            >
              {isAnalyzing
                ? t.employees.import.actions.analyzing
                : t.employees.import.actions.analyze}
            </Button>
            {previewRows.length > 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                {interpolate(t.employees.import.summary, {
                  total: String(previewRows.length),
                  selectable: String(selectableRows.length),
                })}
              </Typography>
            ) : null}
          </Stack>

          {previewRows.length > 0 ? (
            <>
              <Divider />
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        {t.employees.import.table.select}
                      </TableCell>
                      <TableCell>{t.employees.import.table.status}</TableCell>
                      <TableCell>{t.employees.import.table.teta}</TableCell>
                      <TableCell>{t.employees.import.table.employee}</TableCell>
                      <TableCell>{t.employees.import.table.identity}</TableCell>
                      <TableCell>
                        {t.employees.import.table.employment}
                      </TableCell>
                      <TableCell>
                        {t.employees.import.table.department}
                      </TableCell>
                      <TableCell>{t.employees.import.table.housing}</TableCell>
                      <TableCell>{t.employees.import.table.warnings}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row) => {
                      const disabled = row.status !== 'new' || !row.createInput;
                      return (
                        <TableRow hover key={row.id}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              disabled={disabled || isSubmitting}
                              aria-label={interpolate(
                                t.employees.import.table.selectRow,
                                {
                                  employee: formatEmployeeName(row),
                                },
                              )}
                              onChange={() => toggleRow(row.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={statusColors[row.status]}
                              label={t.employees.import.status[row.status]}
                            />
                          </TableCell>
                          <TableCell>
                            {row.tetaNumber || t.employees.import.empty}
                          </TableCell>
                          <TableCell>{formatEmployeeName(row)}</TableCell>
                          <TableCell>{formatIdentity(row, t)}</TableCell>
                          <TableCell>{formatEmployment(row, t)}</TableCell>
                          <TableCell>
                            {row.departmentName ??
                              row.sourceDepartmentName ??
                              t.employees.import.empty}
                          </TableCell>
                          <TableCell>{formatHousing(row, t)}</TableCell>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{ flexWrap: 'wrap' }}
                            >
                              {row.warnings.length === 0 ? (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {t.employees.import.noWarnings}
                                </Typography>
                              ) : (
                                row.warnings.map((warning) => (
                                  <Chip
                                    key={`${row.id}-${warning}`}
                                    size="small"
                                    variant="outlined"
                                    label={warningMessage(warning, t)}
                                  />
                                ))
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.employees.import.actions.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submitImport()}
          disabled={selectedRows.length === 0 || isSubmitting}
        >
          {isSubmitting
            ? t.employees.import.actions.creating
            : interpolate(t.employees.import.actions.createSelected, {
                count: String(selectedRows.length),
              })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface FilePickerProps {
  label: string;
  file: File | null;
  accept: string;
  onChange: (file: File | null) => void;
}

function FilePicker({ label, file, accept, onChange }: FilePickerProps) {
  const t = useTranslations();
  return (
    <Box sx={{ flex: 1 }}>
      <Button component="label" variant="outlined" fullWidth>
        {label}
        <input
          hidden
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {file?.name ?? t.employees.import.files.notSelected}
      </Typography>
    </Box>
  );
}

async function readToyotaRows(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  return parseToyotaEmployeeRowsFromMatrix(matrix);
}

async function readSozRows(file: File, source: 'soz-pl' | 'soz-ua') {
  return parseSozRowsFromCsv(await file.text(), source);
}

function formatEmployeeName(row: EmployeeImportPreviewRow): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function formatIdentity(
  row: EmployeeImportPreviewRow,
  t: ReturnType<typeof useTranslations>,
): string {
  return (
    row.pesel ??
    row.passportNumber ??
    row.foreignDocumentNumber ??
    t.employees.import.empty
  );
}

function formatEmployment(
  row: EmployeeImportPreviewRow,
  t: ReturnType<typeof useTranslations>,
): string {
  const start = formatImportDate(row.employmentStartDate);
  const end = formatImportDate(row.employmentEndDate);
  if (!start) {
    return t.employees.import.empty;
  }
  return end
    ? interpolate(t.employees.import.employmentRange, { start, end })
    : interpolate(t.employees.import.employmentOpenRange, { start });
}

function formatHousing(
  row: EmployeeImportPreviewRow,
  t: ReturnType<typeof useTranslations>,
): string {
  const parts = [];
  if (row.companyHousingMediaAmount > 0) {
    parts.push(
      interpolate(t.employees.import.housing.media, {
        amount: amountFormatter.format(row.companyHousingMediaAmount),
      }),
    );
  }
  if (row.companyHousingAccommodationAmount > 0) {
    parts.push(
      interpolate(t.employees.import.housing.accommodation, {
        amount: amountFormatter.format(row.companyHousingAccommodationAmount),
      }),
    );
  }
  if (row.ownHousingAllowanceAmount > 0) {
    parts.push(
      interpolate(t.employees.import.housing.ownAllowance, {
        amount: amountFormatter.format(row.ownHousingAllowanceAmount),
      }),
    );
  }
  return parts.length > 0 ? parts.join(' · ') : t.employees.import.empty;
}

function warningMessage(
  warning: EmployeeImportWarningCode,
  t: ReturnType<typeof useTranslations>,
): string {
  return t.employees.import.warnings[warning];
}
