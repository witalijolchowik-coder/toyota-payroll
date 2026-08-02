import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
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
  DepartmentAssignmentImportResult,
  EmployeeImportProgress,
} from '../../services/employeeImportService';
import type { Employee } from '../../types/firestore';
import { canonicalDepartmentUiName } from '../../utils/organization';
import {
  buildDepartmentAssignmentReconciliation,
  isApplicableDepartmentAssignmentRow,
  parseBalanceTetaMatrix,
  parseDepartmentAssignmentMatrix,
  type DepartmentAssignmentReconciliation,
  type DepartmentAssignmentReconciliationStatus,
} from './departmentAssignmentImport';

interface DepartmentAssignmentImportDialogProps {
  employees: Employee[];
  onClose: () => void;
  onApply: (
    reconciliation: DepartmentAssignmentReconciliation,
    onProgress?: (progress: EmployeeImportProgress) => void,
  ) => Promise<DepartmentAssignmentImportResult>;
}

const statusColors: Record<
  DepartmentAssignmentReconciliationStatus,
  'success' | 'info' | 'warning' | 'error' | 'default'
> = {
  'existing-unchanged': 'default',
  'existing-changed': 'info',
  'new-employee': 'success',
  'duplicate-source-row-ignored': 'default',
  'unresolved-teta': 'warning',
  'conflicting-department': 'error',
  'excluded-non-worker': 'default',
  'missing-from-assignment-source': 'warning',
  'ambiguous-legacy-metal': 'warning',
  'legacy-department-migrated': 'info',
};

export function DepartmentAssignmentImportDialog({
  employees,
  onClose,
  onApply,
}: DepartmentAssignmentImportDialogProps) {
  const t = useTranslations();
  const copy = t.employees.departmentAssignmentImport;
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [balanceFile, setBalanceFile] = useState<File | null>(null);
  const [preview, setPreview] =
    useState<DepartmentAssignmentReconciliation | null>(null);
  const [progress, setProgress] = useState<EmployeeImportProgress | null>(null);
  const [result, setResult] = useState<DepartmentAssignmentImportResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'analyze' | 'apply' | null>(null);

  const applicableCount = useMemo(
    () => preview?.rows.filter(isApplicableDepartmentAssignmentRow).length ?? 0,
    [preview],
  );

  const analyze = async () => {
    if (!assignmentFile || !balanceFile) {
      setError(copy.errors.filesRequired);
      return;
    }
    setBusy('analyze');
    setError(null);
    setResult(null);
    try {
      const [assignmentMatrix, balanceMatrix] = await Promise.all([
        readFirstWorksheet(assignmentFile),
        readFirstWorksheet(balanceFile),
      ]);
      const reconciliation = buildDepartmentAssignmentReconciliation({
        assignmentRows: parseDepartmentAssignmentMatrix(assignmentMatrix),
        balanceRows: parseBalanceTetaMatrix(balanceMatrix),
        existingEmployees: employees,
      });
      if (reconciliation.assignmentRowCount === 0) {
        throw new Error('assignment-sheet-empty');
      }
      setPreview(reconciliation);
    } catch (caughtError) {
      console.error(caughtError);
      setError(copy.errors.analyzeFailed);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy('apply');
    setError(null);
    setProgress({ completed: 0, total: applicableCount });
    try {
      setResult(await onApply(preview, setProgress));
    } catch (caughtError) {
      console.error(caughtError);
      setError(copy.errors.applyFailed);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="xl" onClose={busy ? undefined : onClose}>
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            {copy.description}
          </Typography>
          <Alert severity="info">{copy.effectiveDateInfo}</Alert>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {result ? (
            <Alert severity="success">
              {interpolate(copy.result, {
                created: String(result.createdEmployeeIds.length),
                updated: String(result.updatedEmployeeIds.length),
                skipped: String(result.skippedCount),
              })}
            </Alert>
          ) : null}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <FilePicker
              label={copy.files.assignment}
              file={assignmentFile}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={Boolean(busy)}
              onChange={(file) => {
                setAssignmentFile(file);
                setPreview(null);
              }}
            />
            <FilePicker
              label={copy.files.balance}
              file={balanceFile}
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={Boolean(busy)}
              onChange={(file) => {
                setBalanceFile(file);
                setPreview(null);
              }}
            />
            <Button
              variant="contained"
              disabled={Boolean(busy)}
              onClick={() => void analyze()}
            >
              {busy === 'analyze'
                ? copy.actions.analyzing
                : copy.actions.preview}
            </Button>
          </Stack>

          {preview ? (
            <>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: 'wrap', gap: 1 }}
              >
                <Chip
                  label={interpolate(copy.summary.sourceRows, {
                    count: String(preview.assignmentRowCount),
                  })}
                />
                <Chip
                  label={interpolate(copy.summary.unique, {
                    count: String(preview.assignmentUniqueEmployeeCount),
                  })}
                />
                <Chip
                  color="info"
                  label={interpolate(copy.summary.updated, {
                    count: String(
                      preview.counts['existing-changed'] +
                        preview.counts['legacy-department-migrated'],
                    ),
                  })}
                />
                <Chip
                  color="success"
                  label={interpolate(copy.summary.created, {
                    count: String(preview.counts['new-employee']),
                  })}
                />
                <Chip
                  label={interpolate(copy.summary.duplicates, {
                    count: String(
                      preview.counts['duplicate-source-row-ignored'],
                    ),
                  })}
                />
                <Chip
                  color="warning"
                  label={interpolate(copy.summary.unresolved, {
                    count: String(preview.counts['unresolved-teta']),
                  })}
                />
                <Chip
                  color="error"
                  label={interpolate(copy.summary.conflicts, {
                    count: String(preview.counts['conflicting-department']),
                  })}
                />
              </Stack>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{copy.table.row}</TableCell>
                      <TableCell>{copy.table.status}</TableCell>
                      <TableCell>{copy.table.employee}</TableCell>
                      <TableCell>{copy.table.teta}</TableCell>
                      <TableCell>{copy.table.currentDepartment}</TableCell>
                      <TableCell>{copy.table.targetDepartment}</TableCell>
                      <TableCell>{copy.table.details}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          {row.sourceRowNumber ?? copy.empty}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColors[row.status]}
                            label={copy.status[row.status]}
                          />
                        </TableCell>
                        <TableCell>
                          {`${row.firstName} ${row.lastName}`.trim() ||
                            row.sourceEmployeeName}
                        </TableCell>
                        <TableCell>{row.tetaNumber ?? copy.empty}</TableCell>
                        <TableCell>
                          {canonicalDepartmentUiName(row.currentDepartmentId) ??
                            row.currentDepartmentId ??
                            copy.empty}
                        </TableCell>
                        <TableCell>{row.targetUiName ?? copy.empty}</TableCell>
                        <TableCell>
                          {row.details
                            ? (copy.details[
                                row.details as keyof typeof copy.details
                              ] ?? row.details)
                            : copy.empty}
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
        {progress ? (
          <Box sx={{ flexGrow: 1, minWidth: 300 }}>
            <Typography variant="caption">
              {interpolate(copy.progress, {
                completed: String(progress.completed),
                total: String(progress.total),
              })}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={
                progress.total ? (progress.completed / progress.total) * 100 : 0
              }
            />
          </Box>
        ) : null}
        <Button onClick={onClose} disabled={Boolean(busy)}>
          {copy.actions.close}
        </Button>
        <Button
          variant="contained"
          disabled={
            !preview ||
            applicableCount === 0 ||
            Boolean(busy) ||
            Boolean(result)
          }
          startIcon={
            busy === 'apply' ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
          onClick={() => void apply()}
        >
          {interpolate(copy.actions.apply, { count: String(applicableCount) })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FilePicker({
  label,
  file,
  accept,
  disabled,
  onChange,
}: {
  label: string;
  file: File | null;
  accept: string;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const t = useTranslations();
  return (
    <Box sx={{ flex: 1 }}>
      <Button
        component="label"
        variant="outlined"
        fullWidth
        disabled={disabled}
      >
        {label}
        <input
          hidden
          type="file"
          accept={accept}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </Button>
      <Typography variant="caption" color="text.secondary">
        {file?.name ?? t.employees.departmentAssignmentImport.files.notSelected}
      </Typography>
    </Box>
  );
}

async function readFirstWorksheet(file: File): Promise<unknown[][]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: '',
  });
}
