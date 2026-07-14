import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type { MonthId } from '../../types/firestore';
import type { ReadinessIssue, ReadinessSeverity } from '../../utils/readiness';
import { routes } from '../../utils/routes';
import { useMonthReadiness } from './useMonthReadiness';

interface MonthReadinessPanelProps {
  monthId: MonthId;
  onMonthChange: (monthId: MonthId) => void;
}

const severityColor: Record<
  ReadinessSeverity,
  'error' | 'warning' | 'info' | 'success'
> = {
  blocking: 'error',
  warning: 'warning',
  optional: 'info',
  info: 'success',
};

export function MonthReadinessPanel({
  monthId,
  onMonthChange,
}: MonthReadinessPanelProps) {
  const t = useTranslations();
  const { data, isLoading, error } = useMonthReadiness(monthId);
  const issuePreview = data?.issues.slice(0, 10) ?? [];

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
        >
          <Box>
            <Typography variant="h6">{t.dashboard.readiness.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {t.dashboard.readiness.description}
            </Typography>
          </Box>
          <TextField
            type="month"
            label={t.dashboard.readiness.month}
            value={monthId}
            onChange={(event) => onMonthChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 220 }}
          />
        </Stack>

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t.dashboard.readiness.loadError}
          </Alert>
        ) : null}

        {isLoading ? (
          <Stack spacing={1.25} sx={{ mt: 3 }}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={38} />
            ))}
          </Stack>
        ) : null}

        {data ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(5, minmax(0, 1fr))',
                },
                gap: 1.5,
                mt: 3,
              }}
            >
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.participants}
                value={data.participants}
                severity="info"
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.blocking}
                value={data.counters.blocking}
                severity="blocking"
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.warning}
                value={data.counters.warning}
                severity="warning"
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.optional}
                value={data.counters.optional}
                severity="optional"
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.month}
                value={
                  data.monthExists
                    ? t.dashboard.readiness.monthExists
                    : t.dashboard.readiness.monthMissing
                }
                severity={data.monthExists ? 'info' : 'blocking'}
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.preparation}
                value={
                  data.levels.dataPreparationPossible
                    ? t.dashboard.readiness.levels.allowed
                    : t.dashboard.readiness.levels.blocked
                }
                severity={
                  data.levels.dataPreparationPossible ? 'info' : 'blocking'
                }
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.draft}
                value={
                  data.levels.draftCalculationPossible
                    ? t.dashboard.readiness.levels.allowed
                    : t.dashboard.readiness.levels.blocked
                }
                severity={
                  data.levels.draftCalculationPossible ? 'info' : 'blocking'
                }
              />
              <ReadinessMetric
                label={t.dashboard.readiness.metrics.finalization}
                value={
                  data.levels.finalizationAllowed
                    ? t.dashboard.readiness.levels.allowed
                    : t.dashboard.readiness.levels.blocked
                }
                severity={data.levels.finalizationAllowed ? 'info' : 'blocking'}
              />
            </Box>

            <Divider sx={{ my: 2.5 }} />

            {issuePreview.length === 0 ? (
              <Alert severity="success">{t.dashboard.readiness.noIssues}</Alert>
            ) : (
              <Stack spacing={1.25}>
                {issuePreview.map((issue, index) => (
                  <ReadinessIssueRow
                    key={`${issue.code}:${issue.employeeId ?? ''}:${issue.context ?? ''}:${index}`}
                    issue={issue}
                  />
                ))}
                {data.issues.length > issuePreview.length ? (
                  <Typography color="text.secondary" variant="body2">
                    {interpolate(t.dashboard.readiness.moreIssues, {
                      count: String(data.issues.length - issuePreview.length),
                    })}
                  </Typography>
                ) : null}
              </Stack>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessMetric({
  label,
  value,
  severity,
}: {
  label: string;
  value: number | string;
  severity: ReadinessSeverity;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
        bgcolor: 'background.default',
      }}
    >
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Chip
        sx={{ mt: 1 }}
        color={severityColor[severity]}
        label={value}
        variant={severity === 'info' ? 'outlined' : 'filled'}
      />
    </Box>
  );
}

function ReadinessIssueRow({ issue }: { issue: ReadinessIssue }) {
  const t = useTranslations();
  const targetRoute =
    issue.target === 'employees'
      ? `${routes.employees}?editEmployeeId=${encodeURIComponent(issue.employeeId ?? '')}`
      : issue.target === 'settings'
        ? routes.settings
        : issue.target === 'absences'
          ? routes.absences
          : routes.settlement;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Chip
          size="small"
          color={severityColor[issue.severity]}
          label={t.dashboard.readiness.severity[issue.severity]}
        />
        <Box>
          <Typography sx={{ fontWeight: 650 }}>
            {t.dashboard.readiness.issues[issue.code]}
          </Typography>
          {issue.employeeName || issue.tetaNumber || issue.context ? (
            <Typography color="text.secondary" variant="body2">
              {[issue.employeeName, issue.tetaNumber, issue.context]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      <Button component={RouterLink} to={targetRoute} size="small">
        {t.dashboard.readiness.correct}
      </Button>
    </Stack>
  );
}

export function ReadinessSeveritySelect({
  value,
}: {
  value: ReadinessSeverity;
}) {
  const t = useTranslations();
  return (
    <TextField select value={value} size="small">
      <MenuItem value={value}>{t.dashboard.readiness.severity[value]}</MenuItem>
    </TextField>
  );
}
