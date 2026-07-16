import { useCallback, useEffect, useRef, useState } from 'react';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import RestoreOutlined from '@mui/icons-material/RestoreOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import {
  persistMonthlyCalculation,
  setMonthLock,
} from '../../services/monthlyCalculationService';
import {
  ensureMonthlyRecoveryPoint,
  listMonthlyRecoveryPoints,
  restoreMonthlyRecoveryPoint,
  type MonthlyRecoveryPoint,
} from '../../services/monthlyRecoveryService';
import type { MonthId, PayrollMonth } from '../../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from '../../utils/payroll';

export function MonthlyCalculationStatusPanel({
  monthId,
  month,
  drafts,
  inputHash,
  employeeCount,
  monthLabel,
  onReload,
}: {
  monthId: MonthId;
  month: PayrollMonth;
  drafts: readonly EmployeeMonthlyCalculationDraft[];
  inputHash: string;
  employeeCount: number;
  monthLabel: string;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryPoints, setRecoveryPoints] = useState<MonthlyRecoveryPoint[]>(
    [],
  );
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const lastAttempt = useRef<string | null>(null);

  const reloadRecoveryPoints = useCallback(async () => {
    setRecoveryPoints(await listMonthlyRecoveryPoints(monthId));
  }, [monthId]);

  useEffect(() => {
    let active = true;
    void listMonthlyRecoveryPoints(monthId)
      .then((points) => {
        if (active) setRecoveryPoints(points);
      })
      .catch(() => {
        if (active) setRecoveryPoints([]);
      });
    return () => {
      active = false;
    };
  }, [monthId]);

  useEffect(() => {
    if (month.isSettled || lastAttempt.current === inputHash) return;
    lastAttempt.current = inputHash;
    const timeout = window.setTimeout(() => {
      setWorking(true);
      setError(null);
      void persistMonthlyCalculation({ monthId, drafts, inputHash })
        .then(async (result) => {
          if (result !== 'persisted') return;
          await onReload();
          await ensureMonthlyRecoveryPoint({ monthId, inputHash });
          await reloadRecoveryPoints();
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : String(reason));
        })
        .finally(() => setWorking(false));
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [
    drafts,
    inputHash,
    month.isSettled,
    monthId,
    onReload,
    reloadRecoveryPoints,
  ]);

  const recalculate = async () => {
    setWorking(true);
    setError(null);
    try {
      await persistMonthlyCalculation({
        monthId,
        drafts,
        inputHash,
        force: true,
      });
      await onReload();
      await ensureMonthlyRecoveryPoint({ monthId, inputHash });
      await reloadRecoveryPoints();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  };

  const createRecoveryPoint = async () => {
    setWorking(true);
    setError(null);
    try {
      await ensureMonthlyRecoveryPoint({ monthId, inputHash, force: true });
      await reloadRecoveryPoints();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  };

  const restoreRecoveryPoint = async (recoveryPoint: MonthlyRecoveryPoint) => {
    if (
      !window.confirm(t.settlement.calculation.recovery.restoreConfirmation)
    ) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await restoreMonthlyRecoveryPoint(monthId, recoveryPoint.id);
      lastAttempt.current = null;
      await Promise.all([onReload(), reloadRecoveryPoints()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  };

  const toggleLock = async () => {
    if (
      month.isSettled &&
      !window.confirm(t.settlement.calculation.unlockConfirmation)
    ) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await setMonthLock(monthId, !month.isSettled);
      lastAttempt.current = null;
      await onReload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  };

  const status = month.isSettled
    ? t.settlement.calculation.locked
    : working || month.calculationStatus === 'running'
      ? t.settlement.calculation.running
      : month.calculationStatus === 'failed'
        ? t.settlement.calculation.failed
        : month.calculationInputHash !== inputHash
          ? t.settlement.calculation.changed
          : month.calculationBlockerCount > 0
            ? t.settlement.calculation.blocked
            : month.calculationStatus === 'completed'
              ? t.settlement.calculation.current
              : t.settlement.calculation.pending;

  return (
    <>
      <Card>
        <CardContent sx={{ px: 2, py: '14px !important' }}>
          <Stack spacing={1}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              useFlexGap
              spacing={1}
              sx={{ alignItems: { lg: 'center' } }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mr: 0.5 }}>
                {monthLabel}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={interpolate(t.settlement.summary.employeesCompact, {
                  count: employeeCount.toString(),
                })}
              />
              <Chip
                size="small"
                variant="outlined"
                label={interpolate(t.settlement.summary.calculationVersion, {
                  version: month.calculationVersion.toString(),
                })}
              />
              <Chip
                size="small"
                color={
                  month.calculationBlockerCount > 0 || error
                    ? 'warning'
                    : 'success'
                }
                label={status}
              />
              <Stack
                direction="row"
                useFlexGap
                spacing={0.5}
                sx={{ ml: { lg: 'auto' }, flexWrap: 'wrap' }}
              >
                <Button
                  size="small"
                  startIcon={<RefreshOutlined />}
                  disabled={working || month.isSettled}
                  onClick={() => void recalculate()}
                >
                  {t.settlement.calculation.recalculate}
                </Button>
                <Button
                  size="small"
                  variant={month.isSettled ? 'outlined' : 'contained'}
                  color={month.isSettled ? 'warning' : 'primary'}
                  startIcon={
                    month.isSettled ? <LockOpenOutlined /> : <LockOutlined />
                  }
                  disabled={
                    working ||
                    (!month.isSettled &&
                      (month.calculationStatus !== 'completed' ||
                        month.calculationInputHash !== inputHash ||
                        month.calculationBlockerCount > 0))
                  }
                  onClick={() => void toggleLock()}
                >
                  {month.isSettled
                    ? t.settlement.calculation.unlock
                    : t.settlement.calculation.lock}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestoreOutlined />}
                  onClick={() => setRecoveryOpen(true)}
                >
                  {t.settlement.calculation.recovery.open}
                </Button>
              </Stack>
            </Stack>
            {error ? (
              <Alert severity="error" sx={{ py: 0 }}>
                {t.settlement.calculation.writeFailed}
              </Alert>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{t.settlement.calculation.recovery.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t.settlement.calculation.recovery.description}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<SaveOutlined />}
              disabled={working || month.isSettled}
              onClick={() => void createRecoveryPoint()}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t.settlement.calculation.recovery.create}
            </Button>
            {recoveryPoints.length === 0 ? (
              <Typography color="text.secondary">
                {t.settlement.calculation.recovery.empty}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {recoveryPoints.map((recoveryPoint) => (
                  <Button
                    key={recoveryPoint.id}
                    variant="outlined"
                    startIcon={<RestoreOutlined />}
                    disabled={working || month.isSettled}
                    onClick={() => void restoreRecoveryPoint(recoveryPoint)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {recoveryPoint.createdAt.toLocaleString('pl-PL')} ·{' '}
                    {formatRecoveryAge(recoveryPoint.createdAt, {
                      minutes: t.settlement.calculation.recovery.ageMinutes,
                      hours: t.settlement.calculation.recovery.ageHours,
                      hoursMinutes:
                        t.settlement.calculation.recovery.ageHoursMinutes,
                    })}{' '}
                    ·{' '}
                    {interpolate(t.settlement.calculation.recovery.itemCount, {
                      count: recoveryPoint.itemCount.toString(),
                    })}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecoveryOpen(false)}>
            {t.settlement.calculation.recovery.close}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function formatRecoveryAge(
  createdAt: Date,
  labels: { minutes: string; hours: string; hoursMinutes: string },
) {
  const ageMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / 60_000),
  );
  if (ageMinutes < 60) {
    return interpolate(labels.minutes, { count: ageMinutes.toString() });
  }
  const hours = Math.floor(ageMinutes / 60);
  const minutes = ageMinutes % 60;
  return minutes > 0
    ? interpolate(labels.hoursMinutes, {
        hours: hours.toString(),
        minutes: minutes.toString(),
      })
    : interpolate(labels.hours, { count: hours.toString() });
}
