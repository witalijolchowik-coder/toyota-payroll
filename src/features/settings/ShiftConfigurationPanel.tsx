import { useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type {
  ActualWorkingShift,
  Department,
  DepartmentShiftMode,
  EmployeeColorShift,
  IsoDate,
} from '../../types/firestore';
import {
  DEFAULT_SHIFT_HOURS,
  previewDepartmentRotation,
  validateDepartmentShiftCorrection,
  validateShiftHours,
  type ShiftCorrectionImpactSummary,
} from '../../utils/schedule';
import { previewShiftCorrectionImpact } from '../../services/shiftCorrectionImpactService';
import { ShiftCorrectionImpactDialog } from './ShiftCorrectionImpactDialog';
import { useShiftConfiguration } from './useShiftConfiguration';

const SHIFTS: ActualWorkingShift[] = ['FIRST', 'SECOND', 'NIGHT'];
const GROUPS: EmployeeColorShift[] = ['RED', 'WHITE', 'BLUE'];

export function ShiftConfigurationPanel({
  departments,
}: {
  departments: Department[];
}) {
  const t = useTranslations();
  const config = useShiftConfiguration();
  const today = new Date().toISOString().slice(0, 10) as IsoDate;
  const [validFrom, setValidFrom] = useState<IsoDate>(today);
  const [intervals, setIntervals] = useState(DEFAULT_SHIFT_HOURS);
  const [departmentId, setDepartmentId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<IsoDate>(today);
  const [shiftMode, setShiftMode] =
    useState<Exclude<DepartmentShiftMode, 'UNKNOWN'>>('THREE_SHIFT');
  const [assignments, setAssignments] = useState<
    Partial<Record<EmployeeColorShift, ActualWorkingShift>>
  >({
    RED: 'FIRST',
    WHITE: 'SECOND',
    BLUE: 'NIGHT',
  });
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactApplying, setImpactApplying] = useState(false);
  const [impact, setImpact] = useState<ShiftCorrectionImpactSummary | null>(
    null,
  );
  const [impactError, setImpactError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeHoursVersion = useMemo(
    () =>
      [...config.shiftHoursVersions]
        .filter((version) => version.active && version.validFrom <= today)
        .sort((first, second) =>
          second.validFrom.localeCompare(first.validFrom),
        )[0] ?? null,
    [config.shiftHoursVersions, today],
  );
  const correctionValidation = validateDepartmentShiftCorrection({
    shiftMode,
    groupAssignments: assignments,
  });
  const preview = useMemo(
    () =>
      previewDepartmentRotation({
        effectiveDate,
        shiftMode,
        groupAssignments: assignments,
      }),
    [assignments, effectiveDate, shiftMode],
  );

  const saveHours = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (!validateShiftHours(intervals))
      return setSubmitError(t.settings.shiftConfiguration.invalidHours);
    try {
      await config.createHours({ validFrom, intervals, note: null });
    } catch {
      setSubmitError(t.settings.shiftConfiguration.saveError);
    }
  };

  const saveCorrection = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (!departmentId || !correctionValidation.valid) return;
    setImpactOpen(true);
    setImpactLoading(true);
    setImpact(null);
    setImpactError(null);
    try {
      const result = await previewShiftCorrectionImpact({
        departmentId,
        effectiveDate,
        shiftMode,
        groupAssignments: assignments,
      });
      setImpact(result);
    } catch {
      setImpactError(t.settings.shiftConfiguration.impact.analysisError);
    } finally {
      setImpactLoading(false);
    }
  };

  const applyCorrection = async () => {
    if (!impact) return;
    setImpactApplying(true);
    setImpactError(null);
    try {
      await config.createCorrection(
        {
          departmentId,
          effectiveDate,
          shiftMode,
          groupAssignments: assignments,
          note: null,
        },
        impact,
      );
      setImpactOpen(false);
      setImpact(null);
    } catch {
      setImpactError(t.settings.shiftConfiguration.impact.applyError);
    } finally {
      setImpactApplying(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6">
              {t.settings.shiftConfiguration.title}
            </Typography>
            <Typography color="text.secondary">
              {t.settings.shiftConfiguration.description}
            </Typography>
          </Box>
          {config.error || submitError ? (
            <Alert severity="error">
              {submitError ?? t.settings.shiftConfiguration.loadError}
            </Alert>
          ) : null}
          <Box component="form" onSubmit={saveHours}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t.settings.shiftConfiguration.hoursTitle}
              </Typography>
              {activeHoursVersion ? (
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t.settings.shiftConfiguration.activeVersion}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {activeHoursVersion.validFrom} ·{' '}
                    {SHIFTS.map(
                      (shift) =>
                        `${t.organization.actualWorkingShifts[shift]} ${activeHoursVersion.intervals[shift].startTime}–${activeHoursVersion.intervals[shift].endTime}`,
                    ).join(' · ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.settings.shiftConfiguration.historicalVersions}:{' '}
                    {Math.max(config.shiftHoursVersions.length - 1, 0)}
                  </Typography>
                </Box>
              ) : null}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                {SHIFTS.map((shift) => (
                  <Box
                    key={shift}
                    sx={{
                      minWidth: 250,
                      flex: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.25,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>
                      {t.organization.actualWorkingShifts[shift]}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <TextField
                        size="small"
                        type="time"
                        label={t.settings.shiftConfiguration.startTime}
                        value={intervals[shift].startTime}
                        onChange={(event) =>
                          setIntervals((current) => ({
                            ...current,
                            [shift]: {
                              ...current[shift],
                              startTime: event.target.value,
                            },
                          }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        size="small"
                        type="time"
                        label={t.settings.shiftConfiguration.endTime}
                        value={intervals[shift].endTime}
                        onChange={(event) =>
                          setIntervals((current) => ({
                            ...current,
                            [shift]: {
                              ...current[shift],
                              endTime: event.target.value,
                            },
                          }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <TextField
                size="small"
                type="date"
                label={t.settings.shiftConfiguration.validFrom}
                value={validFrom}
                onChange={(event) =>
                  setValidFrom(event.target.value as IsoDate)
                }
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ maxWidth: 240 }}
              />
              <Button
                type="submit"
                variant="outlined"
                sx={{ alignSelf: 'flex-start' }}
              >
                {t.settings.shiftConfiguration.saveHours}
              </Button>
            </Stack>
          </Box>
          <Divider />
          <Box component="form" onSubmit={saveCorrection}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t.settings.shiftConfiguration.correctionTitle}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label={t.settings.shiftConfiguration.department}
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  {departments.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="date"
                  label={t.settings.shiftConfiguration.correctionDate}
                  value={effectiveDate}
                  onChange={(event) =>
                    setEffectiveDate(event.target.value as IsoDate)
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  select
                  label={t.settings.shiftConfiguration.mode}
                  value={shiftMode}
                  onChange={(event) => {
                    const mode = event.target.value as Exclude<
                      DepartmentShiftMode,
                      'UNKNOWN'
                    >;
                    setShiftMode(mode);
                    if (mode === 'TWO_SHIFT')
                      setAssignments({ RED: 'FIRST', WHITE: 'SECOND' });
                  }}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="TWO_SHIFT">
                    {t.organization.shiftModes.TWO_SHIFT}
                  </MenuItem>
                  <MenuItem value="THREE_SHIFT">
                    {t.organization.shiftModes.THREE_SHIFT}
                  </MenuItem>
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {GROUPS.filter(
                  (group) => shiftMode === 'THREE_SHIFT' || group !== 'BLUE',
                ).map((group) => (
                  <TextField
                    key={group}
                    select
                    label={`${t.settings.shiftConfiguration.group}: ${t.organization.shifts[group]}`}
                    value={assignments[group] ?? ''}
                    onChange={(event) =>
                      setAssignments((current) => ({
                        ...current,
                        [group]: event.target.value as ActualWorkingShift,
                      }))
                    }
                    sx={{ minWidth: 190 }}
                  >
                    {SHIFTS.filter(
                      (shift) =>
                        shiftMode === 'THREE_SHIFT' || shift !== 'NIGHT',
                    ).map((shift) => (
                      <MenuItem key={shift} value={shift}>
                        {t.organization.actualWorkingShifts[shift]}
                      </MenuItem>
                    ))}
                  </TextField>
                ))}
              </Stack>
              {!correctionValidation.valid ? (
                <Alert severity="warning">
                  {t.settings.shiftConfiguration.invalidMapping}
                </Alert>
              ) : null}
              <Typography variant="subtitle2">
                {t.settings.shiftConfiguration.preview}
              </Typography>
              <TableContainer sx={{ maxWidth: '100%' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {t.settings.shiftConfiguration.week}
                      </TableCell>
                      {GROUPS.filter(
                        (group) =>
                          shiftMode === 'THREE_SHIFT' || group !== 'BLUE',
                      ).map((group) => (
                        <TableCell key={group}>
                          {t.organization.shifts[group]}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((week) => (
                      <TableRow key={week.weekStart} selected={week.selected}>
                        <TableCell>{week.weekStart}</TableCell>
                        {GROUPS.filter(
                          (group) =>
                            shiftMode === 'THREE_SHIFT' || group !== 'BLUE',
                        ).map((group) => (
                          <TableCell key={group}>
                            {week.assignments[group]
                              ? t.organization.actualWorkingShifts[
                                  week.assignments[group]!
                                ]
                              : '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !departmentId ||
                  !correctionValidation.valid ||
                  config.isLoading
                }
                sx={{ alignSelf: 'flex-start' }}
              >
                {t.settings.shiftConfiguration.reviewImpact}
              </Button>
            </Stack>
          </Box>
          {config.departmentCorrections.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t.settings.shiftConfiguration.history}
              </Typography>
              {config.departmentCorrections.map((correction) => (
                <Typography key={correction.id} variant="body2">
                  {correction.effectiveDate} ·{' '}
                  {departments.find(
                    (department) => department.id === correction.departmentId,
                  )?.name ?? t.organization.departments.unassigned}{' '}
                  · {t.organization.shiftModes[correction.shiftMode]}
                </Typography>
              ))}
            </Box>
          ) : null}
        </Stack>
        <ShiftCorrectionImpactDialog
          open={impactOpen}
          departmentName={
            departments.find((department) => department.id === departmentId)
              ?.name ?? t.organization.departments.unassigned
          }
          impact={impact}
          loading={impactLoading}
          applying={impactApplying}
          error={impactError}
          onCancel={() => {
            if (!impactApplying) setImpactOpen(false);
          }}
          onApply={() => void applyCorrection()}
        />
      </CardContent>
    </Card>
  );
}
