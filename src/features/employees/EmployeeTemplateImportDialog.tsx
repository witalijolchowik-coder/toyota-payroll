import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
  Tab,
  Tabs,
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
import type { Department, Employee } from '../../types/firestore';
import {
  buildBulkEmployeeUpdatePreview,
  buildEmployeeUpdateTemplateCsv,
  buildNewEmployeeTemplateCsv,
  buildNewEmployeeTemplatePreview,
  EMPLOYEE_TEMPLATE_CLEAR_MARKER,
  EMPLOYEE_UPDATE_TEMPLATE_FILE_NAME,
  NEW_EMPLOYEE_TEMPLATE_FILE_NAME,
  type BulkEmployeeUpdatePreviewRow,
  type BulkEmployeeUpdateStatus,
  type EmployeeTemplateWarningCode,
  type NewEmployeeTemplatePreviewRow,
  type NewEmployeeTemplateStatus,
} from './employeeTemplateImport';

interface EmployeeTemplateImportDialogProps {
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onCreateEmployees: (rows: NewEmployeeTemplatePreviewRow[]) => Promise<void>;
  onUpdateEmployees: (rows: BulkEmployeeUpdatePreviewRow[]) => Promise<void>;
}

type TemplateTab = 'new' | 'update';

const newStatusColors: Record<
  NewEmployeeTemplateStatus,
  'success' | 'info' | 'warning' | 'error' | 'default'
> = {
  new: 'success',
  existing: 'info',
  duplicate: 'warning',
  conflict: 'error',
  blocked: 'default',
};

const updateStatusColors: Record<
  BulkEmployeeUpdateStatus,
  'success' | 'info' | 'warning' | 'error' | 'default'
> = {
  ready: 'success',
  warning: 'warning',
  blocked: 'error',
  'no-changes': 'default',
};

export function EmployeeTemplateImportDialog({
  employees,
  departments,
  onClose,
  onCreateEmployees,
  onUpdateEmployees,
}: EmployeeTemplateImportDialogProps) {
  const t = useTranslations();
  const [tab, setTab] = useState<TemplateTab>('new');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [newRows, setNewRows] = useState<NewEmployeeTemplatePreviewRow[]>([]);
  const [updateRows, setUpdateRows] = useState<BulkEmployeeUpdatePreviewRow[]>(
    [],
  );
  const [selectedNewIds, setSelectedNewIds] = useState<Set<string>>(new Set());
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedNewRows = useMemo(
    () => newRows.filter((row) => selectedNewIds.has(row.id)),
    [newRows, selectedNewIds],
  );
  const selectedUpdateRows = useMemo(
    () => updateRows.filter((row) => selectedUpdateIds.has(row.id)),
    [updateRows, selectedUpdateIds],
  );

  const analyzeNewFile = async () => {
    if (!newFile) {
      setError(t.employees.templateImport.errors.fileRequired);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const rows = buildNewEmployeeTemplatePreview(
        await newFile.text(),
        employees,
        departments,
      );
      setNewRows(rows);
      setSelectedNewIds(
        new Set(
          rows.filter((row) => row.status === 'new').map((row) => row.id),
        ),
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.templateImport.errors.analyzeFailed);
    } finally {
      setIsBusy(false);
    }
  };

  const analyzeUpdateFile = async () => {
    if (!updateFile) {
      setError(t.employees.templateImport.errors.fileRequired);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const rows = buildBulkEmployeeUpdatePreview(
        await updateFile.text(),
        employees,
        departments,
      );
      setUpdateRows(rows);
      setSelectedUpdateIds(
        new Set(
          rows
            .filter((row) => row.status === 'ready' || row.status === 'warning')
            .map((row) => row.id),
        ),
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.templateImport.errors.analyzeFailed);
    } finally {
      setIsBusy(false);
    }
  };

  const submitNewRows = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onCreateEmployees(selectedNewRows);
      onClose();
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.templateImport.errors.createFailed);
    } finally {
      setIsBusy(false);
    }
  };

  const submitUpdateRows = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await onUpdateEmployees(selectedUpdateRows);
      onClose();
    } catch (caughtError) {
      console.error(caughtError);
      setError(t.employees.templateImport.errors.updateFailed);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog open fullWidth maxWidth="xl" onClose={onClose}>
      <DialogTitle>{t.employees.templateImport.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t.employees.templateImport.description}
          </Typography>
          <Alert severity="info">
            {interpolate(t.employees.templateImport.clearMarkerInfo, {
              marker: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
            })}
          </Alert>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Tabs
            value={tab}
            onChange={(_, value: TemplateTab) => {
              setTab(value);
              setError(null);
            }}
          >
            <Tab
              value="new"
              label={t.employees.templateImport.tabs.newEmployees}
            />
            <Tab
              value="update"
              label={t.employees.templateImport.tabs.updateEmployees}
            />
          </Tabs>

          {tab === 'new' ? (
            <NewEmployeesImportPanel
              file={newFile}
              rows={newRows}
              selectedIds={selectedNewIds}
              isBusy={isBusy}
              onDownload={() =>
                downloadCsv(
                  NEW_EMPLOYEE_TEMPLATE_FILE_NAME,
                  buildNewEmployeeTemplateCsv(),
                )
              }
              onFileChange={setNewFile}
              onAnalyze={() => void analyzeNewFile()}
              onToggle={(rowId) => toggleSetValue(setSelectedNewIds, rowId)}
            />
          ) : (
            <BulkUpdatePanel
              file={updateFile}
              rows={updateRows}
              selectedIds={selectedUpdateIds}
              employees={employees}
              departments={departments}
              isBusy={isBusy}
              onDownload={() =>
                downloadCsv(
                  EMPLOYEE_UPDATE_TEMPLATE_FILE_NAME,
                  buildEmployeeUpdateTemplateCsv(employees, departments),
                )
              }
              onFileChange={setUpdateFile}
              onAnalyze={() => void analyzeUpdateFile()}
              onToggle={(rowId) => toggleSetValue(setSelectedUpdateIds, rowId)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isBusy}>
          {t.employees.templateImport.actions.cancel}
        </Button>
        {tab === 'new' ? (
          <Button
            variant="contained"
            disabled={selectedNewRows.length === 0 || isBusy}
            onClick={() => void submitNewRows()}
          >
            {interpolate(t.employees.templateImport.actions.createSelected, {
              count: String(selectedNewRows.length),
            })}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={selectedUpdateRows.length === 0 || isBusy}
            onClick={() => void submitUpdateRows()}
          >
            {interpolate(t.employees.templateImport.actions.applySelected, {
              count: String(selectedUpdateRows.length),
            })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

interface NewEmployeesImportPanelProps {
  file: File | null;
  rows: NewEmployeeTemplatePreviewRow[];
  selectedIds: Set<string>;
  isBusy: boolean;
  onDownload: () => void;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onToggle: (rowId: string) => void;
}

function NewEmployeesImportPanel({
  file,
  rows,
  selectedIds,
  isBusy,
  onDownload,
  onFileChange,
  onAnalyze,
  onToggle,
}: NewEmployeesImportPanelProps) {
  const t = useTranslations();
  return (
    <Stack spacing={2}>
      <TemplateActions
        file={file}
        downloadLabel={t.employees.templateImport.actions.downloadNewTemplate}
        analyzeLabel={t.employees.templateImport.actions.previewImport}
        isBusy={isBusy}
        onDownload={onDownload}
        onFileChange={onFileChange}
        onAnalyze={onAnalyze}
      />
      {rows.length > 0 ? (
        <>
          <Divider />
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {t.employees.templateImport.table.select}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.status}
                  </TableCell>
                  <TableCell>{t.employees.templateImport.table.teta}</TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.employee}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.identity}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.employment}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.department}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.shift}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.warnings}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow hover key={row.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        disabled={row.status !== 'new' || isBusy}
                        aria-label={interpolate(
                          t.employees.templateImport.table.selectRow,
                          { employee: formatName(row.firstName, row.lastName) },
                        )}
                        onChange={() => onToggle(row.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={newStatusColors[row.status]}
                        label={t.employees.templateImport.newStatus[row.status]}
                      />
                    </TableCell>
                    <TableCell>
                      {row.tetaNumber || t.employees.templateImport.empty}
                    </TableCell>
                    <TableCell>
                      {formatName(row.firstName, row.lastName)}
                    </TableCell>
                    <TableCell>{formatIdentity(row, t)}</TableCell>
                    <TableCell>{formatEmployment(row, t)}</TableCell>
                    <TableCell>
                      {row.departmentName ?? t.employees.templateImport.empty}
                    </TableCell>
                    <TableCell>
                      {row.shiftAssignment ?? t.employees.templateImport.empty}
                    </TableCell>
                    <TableCell>
                      <WarningChips warnings={row.warnings} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Stack>
  );
}

interface BulkUpdatePanelProps {
  file: File | null;
  rows: BulkEmployeeUpdatePreviewRow[];
  selectedIds: Set<string>;
  employees: Employee[];
  departments: Department[];
  isBusy: boolean;
  onDownload: () => void;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onToggle: (rowId: string) => void;
}

function BulkUpdatePanel({
  file,
  rows,
  employees,
  departments,
  selectedIds,
  isBusy,
  onDownload,
  onFileChange,
  onAnalyze,
  onToggle,
}: BulkUpdatePanelProps) {
  const t = useTranslations();
  const includedCount = useMemo(
    () =>
      buildEmployeeUpdateTemplateCsv(employees, departments).split('\r\n')
        .length - 2,
    [departments, employees],
  );
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {interpolate(t.employees.templateImport.updateTemplateInfo, {
          count: String(Math.max(0, includedCount)),
        })}
      </Typography>
      <TemplateActions
        file={file}
        downloadLabel={
          t.employees.templateImport.actions.downloadUpdateTemplate
        }
        analyzeLabel={t.employees.templateImport.actions.previewUpdate}
        isBusy={isBusy}
        onDownload={onDownload}
        onFileChange={onFileChange}
        onAnalyze={onAnalyze}
      />
      {rows.length > 0 ? (
        <>
          <Divider />
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    {t.employees.templateImport.table.select}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.status}
                  </TableCell>
                  <TableCell>{t.employees.templateImport.table.teta}</TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.employee}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.changes}
                  </TableCell>
                  <TableCell>
                    {t.employees.templateImport.table.warnings}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const selectable =
                    row.status === 'ready' || row.status === 'warning';
                  return (
                    <TableRow hover key={row.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          disabled={!selectable || isBusy}
                          aria-label={interpolate(
                            t.employees.templateImport.table.selectRow,
                            {
                              employee: formatName(row.firstName, row.lastName),
                            },
                          )}
                          onChange={() => onToggle(row.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={updateStatusColors[row.status]}
                          label={
                            t.employees.templateImport.updateStatus[row.status]
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {row.tetaNumber || t.employees.templateImport.empty}
                      </TableCell>
                      <TableCell>
                        {formatName(row.firstName, row.lastName)}
                      </TableCell>
                      <TableCell>
                        {row.changes.length > 0 ? (
                          <Stack spacing={0.5}>
                            {row.changes.map((change) => (
                              <Typography
                                key={`${row.id}-${change.field}`}
                                variant="body2"
                              >
                                {interpolate(
                                  t.employees.templateImport.changeDescription,
                                  {
                                    field: change.label,
                                    oldValue:
                                      change.oldValue ||
                                      t.employees.templateImport.empty,
                                    newValue:
                                      change.newValue ||
                                      t.employees.templateImport.empty,
                                  },
                                )}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t.employees.templateImport.noChanges}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <WarningChips warnings={row.warnings} />
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
  );
}

interface TemplateActionsProps {
  file: File | null;
  downloadLabel: string;
  analyzeLabel: string;
  isBusy: boolean;
  onDownload: () => void;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
}

function TemplateActions({
  file,
  downloadLabel,
  analyzeLabel,
  isBusy,
  onDownload,
  onFileChange,
  onAnalyze,
}: TemplateActionsProps) {
  const t = useTranslations();
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <Button variant="outlined" onClick={onDownload} disabled={isBusy}>
        {downloadLabel}
      </Button>
      <Box sx={{ flex: 1 }}>
        <Button
          component="label"
          variant="outlined"
          fullWidth
          disabled={isBusy}
        >
          {t.employees.templateImport.actions.chooseFile}
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          {file?.name ?? t.employees.templateImport.fileNotSelected}
        </Typography>
      </Box>
      <Button variant="contained" onClick={onAnalyze} disabled={isBusy}>
        {analyzeLabel}
      </Button>
    </Stack>
  );
}

function WarningChips({
  warnings,
}: {
  warnings: readonly EmployeeTemplateWarningCode[];
}) {
  const t = useTranslations();
  return warnings.length > 0 ? (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
      {warnings.map((warning) => (
        <Chip
          key={warning}
          size="small"
          variant="outlined"
          label={t.employees.templateImport.warnings[warning]}
        />
      ))}
    </Stack>
  ) : (
    <Typography variant="body2" color="text.secondary">
      {t.employees.templateImport.noWarnings}
    </Typography>
  );
}

function formatName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function formatIdentity(
  row: Pick<
    NewEmployeeTemplatePreviewRow,
    'pesel' | 'passportNumber' | 'foreignDocumentNumber'
  >,
  t: ReturnType<typeof useTranslations>,
): string {
  return (
    row.pesel ??
    row.passportNumber ??
    row.foreignDocumentNumber ??
    t.employees.templateImport.empty
  );
}

function formatEmployment(
  row: Pick<
    NewEmployeeTemplatePreviewRow,
    'employmentStartDate' | 'employmentEndDate'
  >,
  t: ReturnType<typeof useTranslations>,
): string {
  const start = row.employmentStartDate?.toISOString().slice(0, 10);
  const end = row.employmentEndDate?.toISOString().slice(0, 10);
  if (!start) {
    return t.employees.templateImport.empty;
  }
  return end
    ? interpolate(t.employees.templateImport.employmentRange, { start, end })
    : interpolate(t.employees.templateImport.employmentOpenRange, { start });
}

function toggleSetValue(
  setValue: Dispatch<SetStateAction<Set<string>>>,
  value: string,
) {
  setValue((current) => {
    const next = new Set(current);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
