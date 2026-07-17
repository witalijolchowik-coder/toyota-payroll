import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Skeleton,
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

import { PageHeader } from '../components/layout/PageHeader';
import {
  buildDashboardSnapshot,
  type DashboardAbsenceTrendDay,
  type DashboardDeadline,
  type DashboardDepartmentSummary,
} from '../features/dashboard/dashboardModel';
import { useAbsences } from '../features/absences/useAbsences';
import { useEmployeeEntitlements } from '../features/employees/useEmployeeEntitlements';
import { useEmployees } from '../features/employees/useEmployees';
import { useMonthReadiness } from '../features/readiness/useMonthReadiness';
import { useDepartments } from '../features/settings/useDepartments';
import { useTranslations } from '../hooks/useTranslations';
import { interpolate } from '../i18n/pl';
import type { ReadinessIssueCode } from '../utils/readiness';
import { previousPayrollMonthId } from '../utils/payroll';
import { routes } from '../utils/routes';

type DashboardTone = 'neutral' | 'success' | 'warning' | 'error';

const organizationIssueCodes = new Set<ReadinessIssueCode>([
  'employee-missing-department',
  'employee-missing-shift',
  'department-unresolved-na0',
  'department-missing-or-inactive',
  'schedule-unresolved-day',
]);

export function DashboardPage() {
  const t = useTranslations();
  const [monthId, setMonthId] = useState(() =>
    previousPayrollMonthId(new Date()),
  );
  const {
    employees,
    isLoading: employeesLoading,
    error: employeesError,
  } = useEmployees();
  const {
    departments,
    isLoading: departmentsLoading,
    error: departmentsError,
  } = useDepartments();
  const {
    entitlements,
    isLoading: entitlementsLoading,
    error: entitlementsError,
  } = useEmployeeEntitlements();
  const {
    absences,
    currentAbsences,
    isLoading: absencesLoading,
    error: absencesError,
  } = useAbsences(monthId);
  const {
    data: readiness,
    isLoading: readinessLoading,
    error: readinessError,
  } = useMonthReadiness(monthId);
  const snapshot = useMemo(
    () =>
      buildDashboardSnapshot({
        employees,
        departments,
        entitlements,
        selectedMonthAbsences: absences,
        currentAbsences,
        readiness,
      }),
    [
      absences,
      currentAbsences,
      departments,
      employees,
      entitlements,
      readiness,
    ],
  );
  const isLoading =
    employeesLoading ||
    departmentsLoading ||
    entitlementsLoading ||
    absencesLoading ||
    readinessLoading;
  const hasError = Boolean(
    employeesError ||
    departmentsError ||
    entitlementsError ||
    absencesError ||
    readinessError,
  );
  const organizationIssues =
    readiness?.issues.filter((issue) => organizationIssueCodes.has(issue.code))
      .length ?? 0;
  const medicalExpired = snapshot.expiredMedical.length;
  const medicalExpiring = Math.max(
    0,
    snapshot.medicalRenewals.length - medicalExpired,
  );

  const priorities = [
    {
      key: 'blockers',
      count: readiness?.counters.blocking ?? 0,
      title: t.dashboard.priorities.blockers.title,
      description: interpolate(t.dashboard.priorities.blockers.description, {
        month: formatMonth(monthId),
      }),
      to: routes.settlement,
      tone: 'error' as const,
      icon: <ReportProblemOutlined fontSize="small" />,
    },
    {
      key: 'unconfirmed-l4',
      count: snapshot.unconfirmedL4,
      title: t.dashboard.priorities.unconfirmedL4.title,
      description: t.dashboard.priorities.unconfirmedL4.description,
      to: routes.absences,
      tone: 'warning' as const,
      icon: <FactCheckOutlined fontSize="small" />,
    },
    {
      key: 'medical',
      count: snapshot.medicalRenewals.length,
      title: t.dashboard.priorities.medical.title,
      description: interpolate(t.dashboard.priorities.medical.description, {
        expired: String(medicalExpired),
        expiring: String(medicalExpiring),
      }),
      to: `${routes.employees}?medicalAttention=1`,
      tone: medicalExpired > 0 ? ('error' as const) : ('warning' as const),
      icon: <MedicalServicesOutlined fontSize="small" />,
    },
    {
      key: 'contracts',
      count: snapshot.expiringContracts.length,
      title: t.dashboard.priorities.contracts.title,
      description: t.dashboard.priorities.contracts.description,
      to: routes.employees,
      tone: 'warning' as const,
      icon: <CalendarMonthOutlined fontSize="small" />,
    },
    {
      key: 'employee-data',
      count: snapshot.missingEmployeeData,
      title: t.dashboard.priorities.employeeData.title,
      description: t.dashboard.priorities.employeeData.description,
      to: routes.employees,
      tone: 'warning' as const,
      icon: <BadgeOutlined fontSize="small" />,
    },
  ].filter((priority) => priority.count > 0);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={t.dashboard.page.eyebrow}
        title={t.dashboard.page.title}
        description={t.dashboard.page.description}
        action={
          <TextField
            type="month"
            size="small"
            label={t.dashboard.monthSelector}
            value={monthId}
            onChange={(event) => setMonthId(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: { xs: '100%', sm: 210 } }}
          />
        }
      />

      {hasError ? (
        <Alert severity="error">{t.dashboard.loadError}</Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(6, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <KpiCard
          title={t.dashboard.kpi.activeEmployees.title}
          value={snapshot.activeEmployees.length}
          helper={
            <CitizenshipSplit
              polish={snapshot.citizenship.polish}
              foreign={snapshot.citizenship.foreign}
              missing={snapshot.citizenship.missing}
            />
          }
          icon={<GroupsOutlined />}
          to={routes.employees}
          tone="neutral"
          loading={isLoading}
        />
        <KpiCard
          title={t.dashboard.kpi.l4Today.title}
          value={snapshot.confirmedL4Today}
          helper={t.dashboard.kpi.l4Today.helper}
          icon={<EventBusyOutlined />}
          to={routes.absences}
          tone={snapshot.confirmedL4Today > 0 ? 'error' : 'success'}
          loading={isLoading}
        />
        <KpiCard
          title={t.dashboard.kpi.unconfirmedL4.title}
          value={snapshot.unconfirmedL4}
          helper={t.dashboard.kpi.unconfirmedL4.helper}
          icon={<FactCheckOutlined />}
          to={routes.absences}
          tone={snapshot.unconfirmedL4 > 0 ? 'warning' : 'success'}
          loading={isLoading}
        />
        <KpiCard
          title={t.dashboard.kpi.contracts.title}
          value={snapshot.expiringContracts.length}
          helper={t.dashboard.kpi.contracts.helper}
          icon={<CalendarMonthOutlined />}
          to={routes.employees}
          tone={snapshot.expiringContracts.length > 0 ? 'warning' : 'success'}
          loading={isLoading}
        />
        <KpiCard
          title={t.dashboard.kpi.medical.title}
          value={snapshot.medicalRenewals.length}
          helper={interpolate(t.dashboard.kpi.medical.helper, {
            expired: String(medicalExpired),
          })}
          icon={<MedicalServicesOutlined />}
          to={routes.employees}
          tone={medicalExpired > 0 ? 'error' : 'warning'}
          loading={isLoading}
        />
        <KpiCard
          title={t.dashboard.kpi.blockers.title}
          value={readiness?.counters.blocking ?? 0}
          helper={interpolate(t.dashboard.kpi.blockers.helper, {
            month: formatMonth(monthId),
          })}
          icon={<ReportProblemOutlined />}
          to={routes.settlement}
          tone={(readiness?.counters.blocking ?? 0) > 0 ? 'error' : 'success'}
          loading={isLoading}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <DashboardSection
          title={t.dashboard.priorities.title}
          description={t.dashboard.priorities.description}
        >
          {isLoading ? (
            <SectionSkeleton rows={5} />
          ) : priorities.length > 0 ? (
            <Stack divider={<Divider flexItem />}>
              {priorities.map((priority) => (
                <PriorityRow
                  key={priority.key}
                  count={priority.count}
                  title={priority.title}
                  description={priority.description}
                  to={priority.to}
                  tone={priority.tone}
                  icon={priority.icon}
                />
              ))}
            </Stack>
          ) : (
            <Alert severity="success">{t.dashboard.priorities.noIssues}</Alert>
          )}
        </DashboardSection>

        <DashboardSection
          title={t.dashboard.monthReadiness.title}
          description={interpolate(t.dashboard.monthReadiness.description, {
            month: formatMonth(monthId),
          })}
          action={
            <Chip
              size="small"
              color={
                readiness?.levels.finalizationAllowed ? 'success' : 'error'
              }
              variant="outlined"
              label={
                readiness?.levels.finalizationAllowed
                  ? t.dashboard.monthReadiness.ready
                  : t.dashboard.monthReadiness.notReady
              }
            />
          }
        >
          {isLoading ? (
            <SectionSkeleton rows={4} />
          ) : readiness ? (
            <Stack spacing={1.75}>
              <ReadinessRow
                label={t.dashboard.monthReadiness.employeeData}
                issueCount={snapshot.missingEmployeeData}
              />
              <ReadinessRow
                label={t.dashboard.monthReadiness.absences}
                issueCount={snapshot.unconfirmedL4}
              />
              <ReadinessRow
                label={t.dashboard.monthReadiness.organization}
                issueCount={organizationIssues}
              />
              <ReadinessRow
                label={t.dashboard.monthReadiness.finalization}
                issueCount={readiness.levels.finalizationAllowed ? 0 : 1}
                value={
                  readiness.levels.finalizationAllowed
                    ? t.dashboard.monthReadiness.available
                    : t.dashboard.monthReadiness.blocked
                }
              />
              <Button
                component={RouterLink}
                to={routes.settlement}
                variant="outlined"
                sx={{ alignSelf: 'flex-start', mt: 0.5 }}
              >
                {t.dashboard.monthReadiness.open}
              </Button>
            </Stack>
          ) : null}
        </DashboardSection>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.25fr 0.75fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <DashboardSection
          title={t.dashboard.operations.title}
          description={t.dashboard.operations.description}
        >
          {isLoading ? (
            <SectionSkeleton rows={6} />
          ) : snapshot.departmentSummaries.length > 0 ? (
            <DepartmentOperationsTable
              departments={snapshot.departmentSummaries}
            />
          ) : (
            <Typography color="text.secondary">
              {t.dashboard.operations.empty}
            </Typography>
          )}
        </DashboardSection>

        <DashboardSection
          title={t.dashboard.absenceTrend.title}
          description={t.dashboard.absenceTrend.description}
        >
          {isLoading ? (
            <SectionSkeleton rows={5} />
          ) : (
            <AbsenceTrendChart days={snapshot.absenceTrend} />
          )}
        </DashboardSection>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 2,
        }}
      >
        <DashboardSection
          title={t.dashboard.deadlines.title}
          description={t.dashboard.deadlines.description}
        >
          {isLoading ? (
            <SectionSkeleton rows={5} />
          ) : snapshot.deadlines.length > 0 ? (
            <>
              <Stack divider={<Divider flexItem />}>
                {snapshot.deadlines.map((deadline) => (
                  <DeadlineRow
                    key={`${deadline.kind}:${deadline.employee.id}`}
                    deadline={deadline}
                  />
                ))}
              </Stack>
              <Button
                component={RouterLink}
                to={routes.employees}
                size="small"
                sx={{ mt: 1, width: '100%' }}
              >
                {t.dashboard.deadlines.open}
              </Button>
            </>
          ) : (
            <Alert severity="success">{t.dashboard.deadlines.empty}</Alert>
          )}
        </DashboardSection>

        <DashboardSection
          title={t.dashboard.dataQuality.title}
          description={t.dashboard.dataQuality.description}
        >
          <CompactMetric
            label={t.dashboard.dataQuality.pesel}
            value={
              snapshot.activeEmployees.filter((item) => !item.pesel).length
            }
          />
          <CompactMetric
            label={t.dashboard.dataQuality.passport}
            value={
              snapshot.activeEmployees.filter(
                (item) => !item.passportNumber && !item.pesel,
              ).length
            }
          />
          <CompactMetric
            label={t.dashboard.dataQuality.citizenship}
            value={
              snapshot.activeEmployees.filter((item) => !item.citizenship)
                .length
            }
          />
          <CompactMetric
            label={t.dashboard.dataQuality.firstToyotaDate}
            value={
              snapshot.activeEmployees.filter(
                (item) => !item.firstToyotaEmploymentDate,
              ).length
            }
          />
          <Button
            component={RouterLink}
            to={routes.employees}
            size="small"
            sx={{ mt: 1 }}
          >
            {t.dashboard.dataQuality.open}
          </Button>
        </DashboardSection>

        <DashboardSection
          title={t.dashboard.accommodation.title}
          description={t.dashboard.accommodation.description}
        >
          <CompactMetric
            icon={<HomeWorkOutlined fontSize="small" />}
            label={t.dashboard.accommodation.company}
            value={snapshot.accommodation.company}
          />
          <CompactMetric
            icon={<ApartmentOutlined fontSize="small" />}
            label={t.dashboard.accommodation.own}
            value={snapshot.accommodation.ownHousing}
          />
          <CompactMetric
            label={t.dashboard.accommodation.without}
            value={Math.max(
              0,
              snapshot.activeEmployees.length -
                snapshot.accommodation.company -
                snapshot.accommodation.ownHousing,
            )}
          />
          <Button
            component={RouterLink}
            to={routes.employees}
            size="small"
            sx={{ mt: 1 }}
          >
            {t.dashboard.accommodation.open}
          </Button>
        </DashboardSection>
      </Box>

      <DashboardSection
        title={t.dashboard.quickActions.title}
        description={t.dashboard.quickActions.description}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1,
          }}
        >
          <QuickAction
            icon={<PersonAddAltOutlined />}
            label={t.dashboard.quickActions.employees}
            to={routes.employees}
          />
          <QuickAction
            icon={<UploadFileOutlined />}
            label={t.dashboard.quickActions.absences}
            to={routes.absences}
          />
          <QuickAction
            icon={<CalendarMonthOutlined />}
            label={t.dashboard.quickActions.settlement}
            to={routes.settlement}
          />
          <QuickAction
            icon={<SettingsOutlined />}
            label={t.dashboard.quickActions.settings}
            to={routes.settings}
          />
        </Box>
      </DashboardSection>
    </Stack>
  );
}

function CitizenshipSplit({
  polish,
  foreign,
  missing,
}: {
  polish: number;
  foreign: number;
  missing: number;
}) {
  const t = useTranslations();
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.25 }}
    >
      <Box
        component="span"
        aria-label={t.dashboard.kpi.activeEmployees.polish}
        sx={{ fontWeight: 750 }}
      >
        🇵🇱 {polish}
      </Box>
      <Box component="span" sx={{ color: 'text.disabled' }}>
        /
      </Box>
      <Box
        component="span"
        aria-label={t.dashboard.kpi.activeEmployees.foreign}
        sx={{ fontWeight: 750 }}
      >
        🇺🇦 {foreign}
      </Box>
      {missing > 0 ? (
        <Box
          component="span"
          sx={{ color: 'warning.dark', whiteSpace: 'nowrap' }}
        >
          · ? {missing}
        </Box>
      ) : null}
    </Stack>
  );
}

function DepartmentOperationsTable({
  departments,
}: {
  departments: readonly DashboardDepartmentSummary[];
}) {
  const t = useTranslations();
  const totals = departments.reduce(
    (result, department) => ({
      activeEmployees: result.activeEmployees + department.activeEmployees,
      presentEmployees: result.presentEmployees + department.presentEmployees,
      employeesOnL4Today:
        result.employeesOnL4Today + department.employeesOnL4Today,
      otherAbsentEmployees:
        result.otherAbsentEmployees + department.otherAbsentEmployees,
      shiftGroups: {
        red: result.shiftGroups.red + department.shiftGroups.red,
        white: result.shiftGroups.white + department.shiftGroups.white,
        blue: result.shiftGroups.blue + department.shiftGroups.blue,
        unassigned:
          result.shiftGroups.unassigned + department.shiftGroups.unassigned,
      },
    }),
    {
      activeEmployees: 0,
      presentEmployees: 0,
      employeesOnL4Today: 0,
      otherAbsentEmployees: 0,
      shiftGroups: { red: 0, white: 0, blue: 0, unassigned: 0 },
    },
  );

  return (
    <>
      <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table size="small" aria-label={t.dashboard.operations.title}>
          <TableHead>
            <TableRow>
              <TableCell>{t.dashboard.operations.department}</TableCell>
              <TableCell align="right">
                {t.dashboard.operations.active}
              </TableCell>
              <TableCell align="right">
                {t.dashboard.operations.present}
              </TableCell>
              <TableCell align="right">{t.dashboard.operations.l4}</TableCell>
              <TableCell align="right">
                {t.dashboard.operations.otherAbsences}
              </TableCell>
              <TableCell>{t.dashboard.operations.shifts}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departments.map((department) => (
              <DepartmentTableRow key={department.id} department={department} />
            ))}
            <TableRow
              sx={{
                '& td': {
                  bgcolor: 'action.hover',
                  borderBottom: 0,
                  fontWeight: 800,
                },
              }}
            >
              <TableCell>{t.dashboard.operations.total}</TableCell>
              <TableCell align="right">{totals.activeEmployees}</TableCell>
              <TableCell align="right">
                <CountWithPercent
                  count={totals.presentEmployees}
                  total={totals.activeEmployees}
                  color="success.main"
                />
              </TableCell>
              <TableCell align="right">
                <CountWithPercent
                  count={totals.employeesOnL4Today}
                  total={totals.activeEmployees}
                  color="error.main"
                />
              </TableCell>
              <TableCell align="right">
                <CountWithPercent
                  count={totals.otherAbsentEmployees}
                  total={totals.activeEmployees}
                  color="text.secondary"
                />
              </TableCell>
              <TableCell>
                <ShiftGroupSummary groups={totals.shiftGroups} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
        {departments.map((department) => (
          <Box
            key={department.id}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
            }}
          >
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {department.name || t.dashboard.operations.unassigned}
              </Typography>
              <Chip
                size="small"
                label={interpolate(t.dashboard.operations.people, {
                  count: String(department.activeEmployees),
                })}
              />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
                my: 1.25,
              }}
            >
              <MobileDepartmentMetric
                label={t.dashboard.operations.present}
                count={department.presentEmployees}
                total={department.activeEmployees}
                color="success.main"
              />
              <MobileDepartmentMetric
                label={t.dashboard.operations.l4}
                count={department.employeesOnL4Today}
                total={department.activeEmployees}
                color="error.main"
              />
              <MobileDepartmentMetric
                label={t.dashboard.operations.otherAbsences}
                count={department.otherAbsentEmployees}
                total={department.activeEmployees}
                color="text.secondary"
              />
            </Box>
            <ShiftGroupSummary groups={department.shiftGroups} />
          </Box>
        ))}
      </Stack>
    </>
  );
}

function DepartmentTableRow({
  department,
}: {
  department: DashboardDepartmentSummary;
}) {
  const t = useTranslations();
  return (
    <TableRow hover>
      <TableCell sx={{ fontWeight: 750 }}>
        {department.name || t.dashboard.operations.unassigned}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 700 }}>
        {department.activeEmployees}
      </TableCell>
      <TableCell align="right">
        <CountWithPercent
          count={department.presentEmployees}
          total={department.activeEmployees}
          color="success.main"
        />
      </TableCell>
      <TableCell align="right">
        <CountWithPercent
          count={department.employeesOnL4Today}
          total={department.activeEmployees}
          color="error.main"
        />
      </TableCell>
      <TableCell align="right">
        <CountWithPercent
          count={department.otherAbsentEmployees}
          total={department.activeEmployees}
          color="text.secondary"
        />
      </TableCell>
      <TableCell>
        <ShiftGroupSummary groups={department.shiftGroups} />
      </TableCell>
    </TableRow>
  );
}

function CountWithPercent({
  count,
  total,
  color,
}: {
  count: number;
  total: number;
  color: string;
}) {
  return (
    <Stack
      component="span"
      direction="row"
      spacing={0.5}
      sx={{ justifyContent: 'flex-end', alignItems: 'baseline' }}
    >
      <Box component="span" sx={{ color, fontWeight: 800 }}>
        {count}
      </Box>
      <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
        {formatPercent(count, total)}
      </Box>
    </Stack>
  );
}

function MobileDepartmentMetric({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <Box>
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color, fontWeight: 800 }}>
        {count}{' '}
        <Box component="span" sx={{ fontSize: 11, fontWeight: 600 }}>
          {formatPercent(count, total)}
        </Box>
      </Typography>
    </Box>
  );
}

function ShiftGroupSummary({
  groups,
}: {
  groups: DashboardDepartmentSummary['shiftGroups'];
}) {
  const t = useTranslations();
  const entries = [
    { key: 'red', label: 'R', value: groups.red, color: '#d71920' },
    { key: 'white', label: 'W', value: groups.white, color: '#98a2b3' },
    { key: 'blue', label: 'B', value: groups.blue, color: '#2878d0' },
    {
      key: 'unassigned',
      label: '–',
      value: groups.unassigned,
      color: '#667085',
    },
  ].filter((entry) => entry.value > 0);

  return entries.length > 0 ? (
    <Stack
      direction="row"
      spacing={1}
      aria-label={t.dashboard.operations.shifts}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
    >
      {entries.map((entry) => (
        <Stack
          key={entry.key}
          component="span"
          direction="row"
          spacing={0.4}
          sx={{ alignItems: 'center' }}
        >
          <Box
            component="span"
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: entry.color,
            }}
          />
          <Typography component="span" variant="caption">
            {entry.label} {entry.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  ) : (
    <Typography color="text.disabled" variant="body2">
      —
    </Typography>
  );
}

function AbsenceTrendChart({
  days,
}: {
  days: readonly DashboardAbsenceTrendDay[];
}) {
  const t = useTranslations();
  const chartWidth = 560;
  const chartHeight = 230;
  const plot = { left: 34, top: 30, width: 500, height: 145 };
  const maxValue = Math.max(1, ...days.map((day) => day.total));
  const step = plot.width / days.length;
  const barWidth = Math.min(28, step * 0.42);
  const pointFor = (day: DashboardAbsenceTrendDay, index: number) => ({
    x: plot.left + step * index + step / 2,
    y: plot.top + plot.height - (day.total / maxValue) * plot.height,
  });
  const points = days.map(pointFor);
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <Stack spacing={1.25}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <ChartLegend color="#d71920" label={t.dashboard.absenceTrend.l4} />
        <ChartLegend
          color="#4f86df"
          label={t.dashboard.absenceTrend.vacation}
        />
        <ChartLegend
          color="#344054"
          label={t.dashboard.absenceTrend.total}
          line
        />
      </Stack>
      <Box
        component="svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={t.dashboard.absenceTrend.ariaLabel}
        sx={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = plot.top + plot.height - plot.height * ratio;
          return (
            <g key={ratio}>
              <line
                x1={plot.left}
                x2={plot.left + plot.width}
                y1={y}
                y2={y}
                stroke="#e4e7ec"
                strokeWidth="1"
              />
              <text
                x={plot.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#667085"
              >
                {Math.round(maxValue * ratio)}
              </text>
            </g>
          );
        })}
        {days.map((day, index) => {
          const x = plot.left + step * index + (step - barWidth) / 2;
          const vacationHeight = (day.vacation / maxValue) * plot.height;
          const l4Height = (day.l4 / maxValue) * plot.height;
          const bottom = plot.top + plot.height;
          return (
            <g key={day.date.toISOString()}>
              <rect
                x={x}
                y={bottom - vacationHeight}
                width={barWidth}
                height={vacationHeight}
                rx="3"
                fill="#4f86df"
              />
              <rect
                x={x}
                y={bottom - vacationHeight - l4Height}
                width={barWidth}
                height={l4Height}
                rx="3"
                fill="#d71920"
              />
              <text
                x={x + barWidth / 2}
                y={plot.top + plot.height + 24}
                textAnchor="middle"
                fontSize="11"
                fill="#667085"
              >
                {formatChartDate(day.date)}
              </text>
            </g>
          );
        })}
        <polyline
          points={line}
          fill="none"
          stroke="#344054"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={`${point.x}:${point.y}`}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#344054" />
            <text
              x={point.x}
              y={Math.max(14, point.y - 9)}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#344054"
            >
              {days[index]?.total}
            </text>
          </g>
        ))}
      </Box>
      <Button
        component={RouterLink}
        to={routes.absences}
        size="small"
        sx={{ alignSelf: 'center' }}
      >
        {t.dashboard.absenceTrend.open}
      </Button>
    </Stack>
  );
}

function ChartLegend({
  color,
  label,
  line = false,
}: {
  color: string;
  label: string;
  line?: boolean;
}) {
  return (
    <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: line ? 18 : 9,
          height: line ? 2 : 9,
          borderRadius: line ? 0 : 0.75,
          bgcolor: color,
        }}
      />
      <Typography color="text.secondary" variant="caption">
        {label}
      </Typography>
    </Stack>
  );
}

function KpiCard({
  title,
  value,
  helper,
  icon,
  to,
  tone,
  loading,
}: {
  title: string;
  value: number;
  helper: ReactNode;
  icon: ReactNode;
  to: string;
  tone: DashboardTone;
  loading: boolean;
}) {
  const colors = toneColors(tone);
  return (
    <Card sx={{ minWidth: 0, height: '100%' }}>
      <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 2.25, height: '100%' }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'flex-start' }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
                bgcolor: colors.background,
                color: colors.foreground,
              }}
            >
              {icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, lineHeight: 1.25 }}
              >
                {title}
              </Typography>
              {loading ? (
                <Skeleton width={48} height={42} />
              ) : (
                <Typography
                  variant="h4"
                  sx={{ mt: 0.5, color: colors.foreground }}
                >
                  {value}
                </Typography>
              )}
              <Box
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  lineHeight: 1.35,
                }}
              >
                {helper}
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          </Box>
          {action}
        </Stack>
        <Box sx={{ mt: 2.25 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

function PriorityRow({
  count,
  title,
  description,
  to,
  tone,
  icon,
}: {
  count: number;
  title: string;
  description: string;
  to: string;
  tone: DashboardTone;
  icon: ReactNode;
}) {
  const t = useTranslations();
  const colors = toneColors(tone);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{
        py: 1.35,
        alignItems: { sm: 'center' },
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ color: colors.foreground, display: 'grid' }}>{icon}</Box>
        <Typography
          sx={{
            minWidth: 28,
            color: colors.foreground,
            fontWeight: 800,
            fontSize: '1.05rem',
          }}
        >
          {count}
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 750 }}>
            {title}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Button
        component={RouterLink}
        to={to}
        size="small"
        endIcon={<ChevronRightOutlined />}
        sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
      >
        {t.dashboard.priorities.open}
      </Button>
    </Stack>
  );
}

function ReadinessRow({
  label,
  issueCount,
  value,
}: {
  label: string;
  issueCount: number;
  value?: string;
}) {
  const t = useTranslations();
  const ready = issueCount === 0;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          bgcolor: ready ? 'success.main' : 'warning.main',
          flex: '0 0 auto',
        }}
      />
      <Typography variant="body2" sx={{ flex: 1, fontWeight: 650 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: ready ? 'success.main' : 'warning.dark', fontWeight: 750 }}
      >
        {value ??
          (ready
            ? t.dashboard.monthReadiness.noIssues
            : interpolate(t.dashboard.monthReadiness.issues, {
                count: String(issueCount),
              }))}
      </Typography>
    </Stack>
  );
}

function DeadlineRow({ deadline }: { deadline: DashboardDeadline }) {
  const t = useTranslations();
  return (
    <Button
      component={RouterLink}
      to={`${routes.employees}?editEmployeeId=${encodeURIComponent(
        deadline.employee.id,
      )}`}
      color="inherit"
      sx={{
        width: '100%',
        py: 1.25,
        px: 0,
        justifyContent: 'space-between',
        textAlign: 'left',
        '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
      }}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 750 }}>
          {deadline.employee.firstName} {deadline.employee.lastName}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {deadline.kind === 'contract'
            ? t.dashboard.deadlines.contract
            : t.dashboard.deadlines.medical}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {formatDate(deadline.date)}
      </Typography>
    </Button>
  );
}

function CompactMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        py: 1,
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {icon ? (
        <Box sx={{ display: 'grid', color: 'text.secondary' }}>{icon}</Box>
      ) : null}
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800 }}>{value}</Typography>
    </Stack>
  );
}

function QuickAction({
  icon,
  label,
  to,
}: {
  icon: ReactNode;
  label: string;
  to: string;
}) {
  return (
    <Button
      component={RouterLink}
      to={to}
      variant="outlined"
      startIcon={icon}
      sx={{
        justifyContent: 'flex-start',
        minHeight: 48,
        px: 1.5,
        color: 'text.primary',
        borderColor: 'divider',
      }}
    >
      {label}
    </Button>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={38} />
      ))}
    </Stack>
  );
}

function toneColors(tone: DashboardTone) {
  if (tone === 'error') {
    return { foreground: 'error.main', background: 'error.50' };
  }
  if (tone === 'warning') {
    return { foreground: 'warning.dark', background: 'warning.50' };
  }
  if (tone === 'success') {
    return { foreground: 'success.main', background: 'success.50' };
  }
  return { foreground: 'text.primary', background: 'action.hover' };
}

function formatMonth(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatChartDate(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatPercent(count: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}
