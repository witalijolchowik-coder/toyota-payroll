import type { ReactNode } from 'react';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import SyncAltOutlined from '@mui/icons-material/SyncAltOutlined';
import {
  Box,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type {
  DashboardMonthlyRotation,
  DashboardRotationOverview,
} from './dashboardModel';

interface EmployeeRotationPanelProps {
  data: DashboardRotationOverview;
  isLoading: boolean;
  monthId: string;
  onMonthChange: (monthId: string) => void;
}

const RED = '#d2101e';
const GREEN = '#2e7d32';
const MUTED = '#667085';

export function EmployeeRotationPanel({
  data,
  isLoading,
  monthId,
  onMonthChange,
}: EmployeeRotationPanelProps) {
  const t = useTranslations();
  const movementTotal = data.total.hired + data.total.terminated;
  const hiredShare = percentOf(data.total.hired, movementTotal);
  const terminatedShare = percentOf(data.total.terminated, movementTotal);
  const hasUnclassified =
    data.unclassified.averageHeadcount > 0 ||
    data.unclassified.hired > 0 ||
    data.unclassified.terminated > 0;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <IconBadge color={RED} small>
              <SyncAltOutlined />
            </IconBadge>
            <Box>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center' }}
              >
                <Typography variant="h6">
                  {t.dashboard.rotationPanel.title}
                </Typography>
                <Tooltip title={t.dashboard.rotationPanel.formula}>
                  <InfoOutlined
                    aria-label={t.dashboard.rotationPanel.formula}
                    sx={{ color: 'text.secondary', fontSize: 19 }}
                  />
                </Tooltip>
              </Stack>
              <Typography color="text.secondary" variant="caption">
                {t.dashboard.rotationPanel.description}
              </Typography>
            </Box>
          </Stack>
          <TextField
            type="month"
            size="small"
            label={t.dashboard.rotationPanel.month}
            value={monthId}
            onChange={(event) => onMonthChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: '100%', sm: 180 } }}
          />
        </Stack>

        <Divider sx={{ mx: -2, my: 1.5 }} />

        {isLoading ? (
          <RotationPanelSkeleton />
        ) : (
          <Stack spacing={1.25}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              <RotationSummaryCard
                current={data.total}
                previous={data.previousTotal}
                previousMonthId={data.previousMonthId}
              />
              <MovementCard
                title={t.dashboard.rotationPanel.hired}
                value={data.total.hired}
                previousValue={data.previousTotal.hired}
                monthId={data.monthId}
                share={hiredShare}
                shareLabel={t.dashboard.rotationPanel.movementShare}
                color={GREEN}
                icon={<PersonAddAltOutlined />}
              />
              <MovementCard
                title={t.dashboard.rotationPanel.terminated}
                value={data.total.terminated}
                previousValue={data.previousTotal.terminated}
                monthId={data.monthId}
                share={terminatedShare}
                shareLabel={t.dashboard.rotationPanel.movementShare}
                color={RED}
                icon={<PersonRemoveOutlined />}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              <GroupRotationCard
                title={t.dashboard.rotationPanel.polish}
                icon={<GroupsOutlined />}
                current={data.polish}
                previous={data.previousPolish}
                totalTerminated={data.total.terminated}
              />
              <GroupRotationCard
                title={t.dashboard.rotationPanel.foreign}
                icon={<PublicOutlined />}
                current={data.foreign}
                previous={data.previousForeign}
                totalTerminated={data.total.terminated}
              />
            </Box>

            {hasUnclassified ? (
              <Box
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'warning.50',
                  color: 'warning.dark',
                  fontSize: '0.78rem',
                }}
              >
                {interpolate(t.dashboard.rotationPanel.unclassified, {
                  average: formatDecimal(data.unclassified.averageHeadcount),
                  hired: String(data.unclassified.hired),
                  terminated: String(data.unclassified.terminated),
                })}
              </Box>
            ) : null}
          </Stack>
        )}

        <Divider sx={{ mx: -2, mt: 1.5, mb: 1 }} />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <InfoOutlined sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography
            color="text.secondary"
            variant="caption"
            sx={{ lineHeight: 1.25 }}
          >
            {t.dashboard.rotationPanel.formula}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RotationSummaryCard({
  current,
  previous,
  previousMonthId,
}: {
  current: DashboardMonthlyRotation;
  previous: DashboardMonthlyRotation;
  previousMonthId: string;
}) {
  const t = useTranslations();
  const delta = current.rate - previous.rate;
  return (
    <MetricCard>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 750 }}>
            {t.dashboard.rotationPanel.totalRotation}
          </Typography>
          <Typography
            sx={{ color: RED, fontSize: '2.1rem', lineHeight: 1.1, mt: 0.75 }}
          >
            {formatPercent(current.rate)}
          </Typography>
          <Typography
            color="text.secondary"
            variant="caption"
            sx={{ display: 'block', mt: 0.35, lineHeight: 1.25 }}
          >
            {t.dashboard.rotationPanel.formulaShort}
          </Typography>
        </Box>
        <CircularGauge
          value={current.rate}
          color={RED}
          size={64}
          ariaLabel={t.dashboard.rotationPanel.totalRotation}
        >
          <SyncAltOutlined sx={{ color: RED, fontSize: 26 }} />
        </CircularGauge>
      </Stack>
      <LinearProgressBar value={current.rate} color={RED} />
      <DeltaLine
        value={delta}
        suffix={t.dashboard.rotationPanel.percentagePoints}
        comparisonMonth={previousMonthId}
        compact
      />
    </MetricCard>
  );
}

function MovementCard({
  title,
  value,
  previousValue,
  monthId,
  share,
  shareLabel,
  color,
  icon,
}: {
  title: string;
  value: number;
  previousValue: number;
  monthId: string;
  share: number;
  shareLabel: string;
  color: string;
  icon: ReactNode;
}) {
  const t = useTranslations();
  return (
    <MetricCard>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between' }}
      >
        <Box>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 750 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: '2.1rem', lineHeight: 1.1, mt: 0.75 }}>
            {value}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {interpolate(t.dashboard.rotationPanel.inMonth, {
              month: formatMonth(monthId),
            })}
          </Typography>
        </Box>
        <IconBadge color={color} large>
          {icon}
        </IconBadge>
      </Stack>
      <DeltaLine
        value={value - previousValue}
        comparisonMonth={precedingMonthLabel(monthId)}
        tone={color}
        compact
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgressBar value={share} color={color} compact />
        </Box>
        <Typography sx={{ color, fontWeight: 750 }}>
          {formatPercent(share)}
        </Typography>
      </Stack>
      <Typography
        color="text.secondary"
        variant="caption"
        sx={{ display: 'block', mt: 0.25, lineHeight: 1.2 }}
      >
        {shareLabel}
      </Typography>
    </MetricCard>
  );
}

function GroupRotationCard({
  title,
  icon,
  current,
  previous,
  totalTerminated,
}: {
  title: string;
  icon: ReactNode;
  current: DashboardMonthlyRotation;
  previous: DashboardMonthlyRotation;
  totalTerminated: number;
}) {
  const t = useTranslations();
  const projectShare = percentOf(current.terminated, totalTerminated);
  return (
    <MetricCard>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <IconBadge color={RED} small>
          {icon}
        </IconBadge>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 750 }}>
          {title}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: '0.85fr 1fr 0.65fr 0.65fr',
          },
          gap: 0,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            gridRow: { xs: 'span 2', sm: 'auto' },
            display: 'grid',
            placeItems: 'center',
            pr: 1,
          }}
        >
          <CircularGauge
            value={current.rate}
            color={RED}
            size={78}
            ariaLabel={interpolate(t.dashboard.rotationPanel.groupRateLabel, {
              group: title,
            })}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                sx={{ color: RED, fontSize: '1.05rem', fontWeight: 800 }}
              >
                {formatPercent(current.rate)}
              </Typography>
              <Typography
                color="text.secondary"
                variant="caption"
                sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.05 }}
              >
                {t.dashboard.rotationPanel.groupRotation}
              </Typography>
            </Box>
          </CircularGauge>
        </Box>
        <GroupMetric
          label={t.dashboard.rotationPanel.projectShare}
          value={formatPercent(projectShare)}
          progress={projectShare}
          color={RED}
        />
        <GroupMetric
          label={t.dashboard.rotationPanel.hired}
          value={String(current.hired)}
          icon={<PersonAddAltOutlined />}
          color={GREEN}
        />
        <GroupMetric
          label={t.dashboard.rotationPanel.terminated}
          value={String(current.terminated)}
          icon={<PersonRemoveOutlined />}
          color={RED}
        />
      </Box>
      <Divider sx={{ my: 1 }} />
      <DeltaLine
        value={current.rate - previous.rate}
        suffix={t.dashboard.rotationPanel.percentagePoints}
        comparisonMonth={previous.monthId}
        compact
      />
    </MetricCard>
  );
}

function GroupMetric({
  label,
  value,
  progress,
  icon,
  color,
}: {
  label: string;
  value: string;
  progress?: number;
  icon?: ReactNode;
  color: string;
}) {
  return (
    <Box
      sx={{
        minHeight: 80,
        px: { xs: 0.75, sm: 1 },
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      <Typography
        color="text.secondary"
        variant="caption"
        sx={{ display: 'block', minHeight: 28, lineHeight: 1.15 }}
      >
        {label}
      </Typography>
      {icon ? (
        <Box sx={{ color, mt: 0.35, mb: 0.1, '& svg': { fontSize: 18 } }}>
          {icon}
        </Box>
      ) : null}
      <Typography sx={{ color, fontSize: '1.1rem', fontWeight: 750 }}>
        {value}
      </Typography>
      {progress !== undefined ? (
        <LinearProgressBar value={progress} color={color} compact />
      ) : null}
    </Box>
  );
}

function MetricCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2.5,
        bgcolor: 'background.paper',
      }}
    >
      {children}
    </Box>
  );
}

function IconBadge({
  children,
  color,
  large = false,
  small = false,
}: {
  children: ReactNode;
  color: string;
  large?: boolean;
  small?: boolean;
}) {
  const size = large ? 52 : small ? 34 : 40;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        bgcolor: color === GREEN ? '#edf7ed' : '#fdecec',
        color,
        '& svg': { fontSize: large ? 28 : small ? 19 : 23 },
      }}
    >
      {children}
    </Box>
  );
}

function CircularGauge({
  value,
  color,
  size,
  ariaLabel,
  children,
}: {
  value: number;
  color: string;
  size: number;
  ariaLabel: string;
  children: ReactNode;
}) {
  const progress = clamp(value, 0, 100);
  return (
    <Box
      role="img"
      aria-label={`${ariaLabel}: ${formatPercent(value)}`}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: '50%',
        background: `conic-gradient(${color} ${progress}%, #f2f4f7 0)`,
        display: 'grid',
        placeItems: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: size >= 100 ? 10 : 7,
          borderRadius: '50%',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>{children}</Box>
    </Box>
  );
}

function LinearProgressBar({
  value,
  color,
  compact = false,
}: {
  value: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <LinearProgress
      variant="determinate"
      value={clamp(value, 0, 100)}
      sx={{
        mt: compact ? 0.5 : 1,
        height: compact ? 6 : 7,
        borderRadius: 999,
        bgcolor: '#eaecf0',
        '& .MuiLinearProgress-bar': {
          borderRadius: 999,
          bgcolor: color,
        },
      }}
    />
  );
}

function DeltaLine({
  value,
  suffix,
  comparisonMonth,
  tone: toneOverride,
  compact = false,
}: {
  value: number;
  suffix?: string;
  comparisonMonth: string;
  tone?: string;
  compact?: boolean;
}) {
  const t = useTranslations();
  const tone =
    value === 0 ? MUTED : (toneOverride ?? (value > 0 ? RED : GREEN));
  const Icon =
    value > 0
      ? ArrowUpwardRounded
      : value < 0
        ? ArrowDownwardRounded
        : RemoveRounded;
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{
        alignItems: 'center',
        mt: compact ? 0.75 : 1.5,
        flexWrap: 'wrap',
      }}
    >
      <Icon sx={{ color: tone, fontSize: compact ? 16 : 18 }} />
      <Typography
        sx={{
          color: tone,
          fontWeight: 750,
          fontSize: compact ? '0.75rem' : undefined,
        }}
        variant="body2"
      >
        {formatSigned(value)}
        {suffix ? ` ${suffix}` : ''}
      </Typography>
      <Typography
        color="text.secondary"
        variant="body2"
        sx={{ fontSize: compact ? '0.75rem' : undefined }}
      >
        {interpolate(t.dashboard.rotationPanel.vsMonth, {
          month: formatMonth(comparisonMonth),
        })}
      </Typography>
    </Stack>
  );
}

function RotationPanelSkeleton() {
  return (
    <Stack spacing={1.25}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 1.25,
        }}
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={180} />
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
          gap: 1.25,
        }}
      >
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={170} />
        ))}
      </Box>
    </Stack>
  );
}

function percentOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPercent(value: number): string {
  return `${formatDecimal(value)}%`;
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${formatDecimal(Math.abs(rounded))}`;
}

function formatMonth(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function precedingMonthLabel(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}
