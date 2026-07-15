import { useMemo, useState } from 'react';
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
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
import type {
  PlannedScheduleDay,
  ShiftCorrectionImpactSummary,
} from '../../utils/schedule';
import { interpolate } from '../../i18n/pl';

type DetailFilter = 'all' | 'review' | 'manual' | 'overtime' | 'absence';

export function ShiftCorrectionImpactDialog({
  open,
  departmentName,
  impact,
  loading,
  applying,
  error,
  onCancel,
  onApply,
}: {
  open: boolean;
  departmentName: string;
  impact: ShiftCorrectionImpactSummary | null;
  loading: boolean;
  applying: boolean;
  error: string | null;
  onCancel: () => void;
  onApply: () => void;
}) {
  const t = useTranslations();
  const copy = t.settings.shiftConfiguration.impact;
  const [showDetails, setShowDetails] = useState(false);
  const [filter, setFilter] = useState<DetailFilter>('all');
  const details = useMemo(
    () =>
      (impact?.details ?? []).filter((detail) => {
        if (filter === 'review') return detail.requiresReview;
        if (filter === 'manual') return detail.hasManualActual;
        if (filter === 'overtime') return detail.hasOvertime;
        if (filter === 'absence') return detail.hasAbsence;
        return true;
      }),
    [filter, impact],
  );
  const counters: Array<readonly [string, number]> = impact
    ? [
        [copy.counters.employees, impact.employeeCount],
        [copy.counters.planDays, impact.changedPlanDayCount],
        [copy.counters.manual, impact.manualActualCount],
        [copy.counters.overtime, impact.overtimeCount],
        [copy.counters.shortage, impact.shortageOrPrivateTimeCount],
        [copy.counters.absences, impact.absenceCount],
        [copy.counters.confirmedL4, impact.confirmedL4Count],
        [copy.counters.review, impact.reviewRequiredCount],
      ]
    : [];

  return (
    <Dialog
      open={open}
      onClose={applying ? undefined : onCancel}
      fullWidth
      maxWidth="xl"
    >
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack spacing={2} sx={{ py: 8, alignItems: 'center' }}>
            <CircularProgress />
            <Typography>{copy.loading}</Typography>
          </Stack>
        ) : impact ? (
          <Stack spacing={2.5}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{departmentName}</Typography>
              <Typography color="text.secondary">
                {interpolate(copy.range, {
                  start: impact.rangeStart,
                  end: impact.rangeEnd,
                })}
              </Typography>
              {impact.boundedByNextCorrection ? (
                <Typography variant="body2" color="text.secondary">
                  {copy.boundedByNext}
                </Typography>
              ) : null}
            </Box>
            {impact.changedPlanDayCount === 0 ? (
              <Alert severity="success">{copy.zeroImpact}</Alert>
            ) : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 1.25,
              }}
            >
              {counters.map(([label, value]) => (
                <Box
                  key={label}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
            {impact.manualActualCount > 0 || impact.absenceCount > 0 ? (
              <Alert severity="warning">{copy.strongConfirmation}</Alert>
            ) : null}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              <ImpactGroup
                title={copy.groups.recalculated}
                items={copy.recalculated}
              />
              <ImpactGroup
                title={copy.groups.preserved}
                items={copy.preserved}
              />
              <ImpactGroup title={copy.groups.review} items={copy.review} />
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <Button
                variant="outlined"
                onClick={() => setShowDetails((value) => !value)}
              >
                {showDetails ? copy.hideDetails : copy.showDetails}
              </Button>
              {showDetails ? (
                <FormControl size="small" sx={{ minWidth: 230 }}>
                  <InputLabel>{copy.filter.label}</InputLabel>
                  <Select
                    label={copy.filter.label}
                    value={filter}
                    onChange={(event) =>
                      setFilter(event.target.value as DetailFilter)
                    }
                  >
                    {(Object.keys(copy.filter.options) as DetailFilter[]).map(
                      (value) => (
                        <MenuItem key={value} value={value}>
                          {copy.filter.options[value]}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              ) : null}
            </Stack>
            {showDetails ? (
              <TableContainer
                sx={{
                  maxHeight: 360,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{copy.table.employee}</TableCell>
                      <TableCell>{copy.table.teta}</TableCell>
                      <TableCell>{copy.table.date}</TableCell>
                      <TableCell>{copy.table.before}</TableCell>
                      <TableCell>{copy.table.after}</TableCell>
                      <TableCell>{copy.table.markers}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.map((detail) => (
                      <TableRow key={`${detail.employeeId}-${detail.date}`}>
                        <TableCell>{detail.employeeName}</TableCell>
                        <TableCell>{detail.tetaNumber}</TableCell>
                        <TableCell>{detail.date}</TableCell>
                        <TableCell>{formatPlan(detail.before, t)}</TableCell>
                        <TableCell>{formatPlan(detail.after, t)}</TableCell>
                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            useFlexGap
                            sx={{ flexWrap: 'wrap' }}
                          >
                            {detail.hasManualActual ? (
                              <Chip size="small" label={copy.markers.manual} />
                            ) : null}
                            {detail.hasOvertime ? (
                              <Chip
                                size="small"
                                label={copy.markers.overtime}
                              />
                            ) : null}
                            {detail.hasShortageOrPrivateTime ? (
                              <Chip
                                size="small"
                                label={copy.markers.shortage}
                              />
                            ) : null}
                            {detail.hasAbsence ? (
                              <Chip size="small" label={copy.markers.absence} />
                            ) : null}
                            {detail.hasConfirmedL4 ? (
                              <Chip
                                size="small"
                                color="error"
                                label={copy.markers.confirmedL4}
                              />
                            ) : null}
                            {detail.requiresReview ? (
                              <Chip
                                size="small"
                                color="warning"
                                label={copy.markers.review}
                              />
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {details.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>{copy.noDetails}</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={applying}>
          {copy.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={onApply}
          disabled={loading || applying || !impact}
        >
          {applying ? copy.applying : copy.apply}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImpactGroup({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
      <Typography sx={{ mb: 0.75, fontWeight: 700 }}>{title}</Typography>
      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
        {items.map((item) => (
          <Typography component="li" variant="body2" key={item}>
            {item}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

function formatPlan(
  day: PlannedScheduleDay,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!day.shift || !day.plannedStartTime || !day.plannedEndTime) {
    return t.settings.shiftConfiguration.impact.notApplicable;
  }
  return `${t.organization.actualWorkingShifts[day.shift]} · ${day.plannedStartTime}–${day.plannedEndTime}`;
}
