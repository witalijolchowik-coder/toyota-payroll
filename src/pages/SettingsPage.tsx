import { useMemo, useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import HotelOutlined from '@mui/icons-material/HotelOutlined';
import PaletteOutlined from '@mui/icons-material/PaletteOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
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
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '../components/layout/PageHeader';
import {
  AccommodationCategoryFormDialog,
  type AccommodationCategoryInput,
} from '../features/settings/AccommodationCategoryFormDialog';
import { CalendarAppearancePanel } from '../features/settings/CalendarAppearancePanel';
import { DepartmentFormDialog } from '../features/settings/DepartmentFormDialog';
import { PayrollSettingFormDialog } from '../features/settings/PayrollSettingFormDialog';
import { ShiftConfigurationPanel } from '../features/settings/ShiftConfigurationPanel';
import { useDepartments } from '../features/settings/useDepartments';
import { usePayrollSettings } from '../features/settings/usePayrollSettings';
import { useNotification } from '../hooks/useNotification';
import { useTranslations } from '../hooks/useTranslations';
import type {
  Department,
  DepartmentCreateInput,
  DepartmentUpdateInput,
  KnownPayrollSettingKey,
  PayrollSetting,
  PayrollSettingCreateInput,
} from '../types/firestore';
import {
  currentPayrollMonthId,
  payrollSettingLifecycleStatus,
} from '../utils/payroll';
import {
  SETTINGS_SECTION_STORAGE_KEY,
  resolveSettingsSection,
  type SettingsSection,
} from './settingsNavigation';

const currency = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

type DepartmentFormState =
  { mode: 'add' } | { mode: 'edit'; department: Department } | null;
type SettingFormState =
  | {
      section: 'accommodation';
      initialKey: 'own_housing_allowance' | 'housing_deposit';
    }
  | { section: 'allowances'; initialKey?: KnownPayrollSettingKey }
  | { section: 'edit'; setting: PayrollSetting }
  | null;

export function SettingsPage() {
  const t = useTranslations();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySection = searchParams.get('section');
  const storedSection = window.localStorage.getItem(
    SETTINGS_SECTION_STORAGE_KEY,
  );
  const section = resolveSettingsSection(querySection ?? storedSection);
  const {
    settings,
    isLoading,
    error,
    createVersion,
    updateVersion,
    previewVersion,
    endVersion,
    cancelVersion,
  } = usePayrollSettings();
  const {
    departments,
    isLoading: areDepartmentsLoading,
    error: departmentsError,
    addDepartment,
    editDepartment,
  } = useDepartments();
  const { notify } = useNotification();
  const [departmentFormState, setDepartmentFormState] =
    useState<DepartmentFormState>(null);
  const [settingFormState, setSettingFormState] =
    useState<SettingFormState>(null);
  const [isAccommodationFormOpen, setIsAccommodationFormOpen] = useState(false);

  const accommodationCategories = useMemo(
    () =>
      settings
        .filter(
          (setting) =>
            setting.settingKey === 'accommodation_allowance' &&
            setting.variantKey,
        )
        .map((rent) => ({
          key: rent.variantKey!,
          name: rent.variantName ?? rent.variantKey!,
          validFrom: rent.validFrom,
          validTo: rent.validTo,
          accommodation: rent.amount,
          media:
            settings.find(
              (setting) =>
                setting.settingKey === 'company_housing_media' &&
                setting.variantKey === rent.variantKey &&
                setting.validFrom === rent.validFrom,
            )?.amount ?? 0,
        })),
    [settings],
  );

  const selectSection = (next: SettingsSection) => {
    window.localStorage.setItem(SETTINGS_SECTION_STORAGE_KEY, next);
    setSearchParams({ section: next }, { replace: true });
  };

  const handleCreate = async (input: PayrollSettingCreateInput) => {
    if (settingFormState?.section === 'edit') {
      await updateVersion(settingFormState.setting, input);
      notify({
        message: t.settings.versionActions.edited,
        severity: 'success',
      });
      return;
    }
    await createVersion(input);
    notify({
      message: t.settings.common.versionSaved,
      severity: 'success',
    });
  };

  const handleEndVersion = async (setting: PayrollSetting) => {
    const validTo = window.prompt(
      t.settings.versionActions.endPrompt,
      currentPayrollMonthId(new Date()),
    );
    if (!validTo) return;
    await endVersion(setting, validTo);
    notify({ message: t.settings.versionActions.ended, severity: 'success' });
  };

  const handleCancelVersion = async (setting: PayrollSetting) => {
    if (!window.confirm(t.settings.versionActions.cancelConfirm)) return;
    await cancelVersion(setting, currentPayrollMonthId(new Date()));
    notify({
      message: t.settings.versionActions.cancelled,
      severity: 'success',
    });
  };

  const handleDepartmentSubmit = async (
    input: DepartmentCreateInput | DepartmentUpdateInput,
  ) => {
    if (departmentFormState?.mode === 'edit') {
      await editDepartment(departmentFormState.department.id, input);
      notify({
        message: t.organization.departments.notifications.updated,
        severity: 'success',
      });
      return;
    }
    await addDepartment(input as DepartmentCreateInput);
    notify({
      message: t.organization.departments.notifications.created,
      severity: 'success',
    });
  };

  const handleAccommodationCategory = async (
    input: AccommodationCategoryInput,
  ) => {
    await createVersion({
      settingKey: 'accommodation_allowance',
      variantKey: input.key,
      variantName: input.name,
      amount: input.accommodationAmount,
      validFrom: input.validFrom,
      validTo: null,
      description: input.description,
    });
    await createVersion({
      settingKey: 'company_housing_media',
      variantKey: input.key,
      variantName: input.name,
      amount: input.mediaAmount,
      validFrom: input.validFrom,
      validTo: null,
      description: input.description,
    });
    notify({
      message: t.settings.accommodation.saved,
      severity: 'success',
    });
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={t.settings.page.eyebrow}
        title={t.settings.page.title}
        description={t.settings.page.description}
      />
      {(error || departmentsError) && section !== 'interface' ? (
        <Alert severity="error">{t.settings.page.loadError}</Alert>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: '220px minmax(0, 1fr)',
          },
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
        }}
      >
        <SettingsNavigation section={section} onChange={selectSection} />
        <Box component="section" aria-live="polite" sx={{ minWidth: 0 }}>
          {section === 'shifts' ? (
            <ShiftsSection
              departments={departments}
              isLoading={areDepartmentsLoading}
              onAdd={() => setDepartmentFormState({ mode: 'add' })}
              onEdit={(department) =>
                setDepartmentFormState({ mode: 'edit', department })
              }
            />
          ) : null}
          {section === 'accommodation' ? (
            <AccommodationSection
              categories={accommodationCategories}
              settings={settings}
              isLoading={isLoading}
              onAddCategory={() => setIsAccommodationFormOpen(true)}
              onAddOwnHousing={() =>
                setSettingFormState({
                  section: 'accommodation',
                  initialKey: 'own_housing_allowance',
                })
              }
              onAddDeposit={() =>
                setSettingFormState({
                  section: 'accommodation',
                  initialKey: 'housing_deposit',
                })
              }
              onEndVersion={handleEndVersion}
              onCancelVersion={handleCancelVersion}
              onEditVersion={(setting) =>
                setSettingFormState({ section: 'edit', setting })
              }
            />
          ) : null}
          {section === 'allowances' ? (
            <AllowancesSection
              settings={settings}
              isLoading={isLoading}
              onAdd={() => setSettingFormState({ section: 'allowances' })}
              onEndVersion={handleEndVersion}
              onCancelVersion={handleCancelVersion}
              onEditVersion={(setting) =>
                setSettingFormState({ section: 'edit', setting })
              }
            />
          ) : null}
          {section === 'interface' ? <CalendarAppearancePanel /> : null}
        </Box>
      </Box>

      {settingFormState ? (
        <PayrollSettingFormDialog
          settings={settings}
          existingSetting={
            settingFormState.section === 'edit'
              ? settingFormState.setting
              : undefined
          }
          initialKey={
            settingFormState.section === 'edit'
              ? undefined
              : settingFormState.initialKey
          }
          allowedKeys={
            settingFormState.section === 'edit'
              ? undefined
              : settingFormState.section === 'accommodation'
                ? ['own_housing_allowance', 'housing_deposit']
                : [
                    'frequency_bonus',
                    'transport_allowance',
                    'udt_allowance',
                    'holiday_work_bonus',
                    'laundry_allowance',
                    'own_housing_allowance',
                  ]
          }
          onClose={() => setSettingFormState(null)}
          onSubmit={handleCreate}
          onPreview={
            settingFormState.section === 'edit'
              ? (input) => previewVersion(settingFormState.setting, input)
              : undefined
          }
        />
      ) : null}
      {departmentFormState ? (
        <DepartmentFormDialog
          department={
            departmentFormState.mode === 'edit'
              ? departmentFormState.department
              : undefined
          }
          onClose={() => setDepartmentFormState(null)}
          onSubmit={handleDepartmentSubmit}
        />
      ) : null}
      {isAccommodationFormOpen ? (
        <AccommodationCategoryFormDialog
          onClose={() => setIsAccommodationFormOpen(false)}
          onSubmit={handleAccommodationCategory}
        />
      ) : null}
    </Stack>
  );
}

export function SettingsNavigation({
  section,
  onChange,
}: {
  section: SettingsSection;
  onChange: (section: SettingsSection) => void;
}) {
  const t = useTranslations();
  const items = [
    {
      id: 'shifts' as const,
      label: t.settings.navigation.shifts,
      icon: <ScheduleOutlined />,
    },
    {
      id: 'accommodation' as const,
      label: t.settings.navigation.accommodation,
      icon: <HotelOutlined />,
    },
    {
      id: 'allowances' as const,
      label: t.settings.navigation.allowances,
      icon: <PaymentsOutlined />,
    },
    {
      id: 'interface' as const,
      label: t.settings.navigation.interface,
      icon: <PaletteOutlined />,
    },
  ];
  return (
    <Box component="nav" aria-label={t.settings.navigation.label}>
      <TextField
        select
        fullWidth
        size="small"
        label={t.settings.navigation.label}
        value={section}
        onChange={(event) => onChange(event.target.value as SettingsSection)}
        sx={{ display: { xs: 'flex', md: 'none' } }}
      >
        {items.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.label}
          </MenuItem>
        ))}
      </TextField>
      <Card
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'sticky',
          top: 92,
        }}
      >
        <List disablePadding aria-label={t.settings.navigation.label}>
          {items.map((item) => (
            <ListItemButton
              key={item.id}
              selected={item.id === section}
              onClick={() => onChange(item.id)}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </Box>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box>
      <Typography variant="h5">{title}</Typography>
      <Typography color="text.secondary">{description}</Typography>
    </Box>
  );
}

function ShiftsSection({
  departments,
  isLoading,
  onAdd,
  onEdit,
}: {
  departments: Department[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (department: Department) => void;
}) {
  const t = useTranslations();
  return (
    <Stack spacing={2.5}>
      <SectionHeading
        title={t.settings.shiftsAndSchedules.title}
        description={t.settings.shiftsAndSchedules.description}
      />
      <Card>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            px: 2.5,
            py: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6">
            {t.settings.shiftsAndSchedules.departments}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAdd}
          >
            {t.organization.departments.add}
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.organization.departments.table.name}</TableCell>
                <TableCell>
                  {t.organization.departments.table.shiftMode}
                </TableCell>
                <TableCell>{t.organization.departments.table.status}</TableCell>
                <TableCell align="right">
                  {t.settings.versionActions.actions}
                </TableCell>
                <TableCell align="right">
                  {t.organization.departments.table.actions}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <LoadingRows columns={4} />
              ) : (
                departments.map((department) => (
                  <TableRow hover key={department.id}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {department.name}
                    </TableCell>
                    <TableCell>
                      {t.organization.shiftModes[department.shiftMode]}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={department.active ? 'success' : 'default'}
                        label={
                          department.active
                            ? t.organization.departments.status.active
                            : t.organization.departments.status.inactive
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label={t.organization.departments.table.edit}
                        onClick={() => onEdit(department)}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <ShiftConfigurationPanel departments={departments} />
    </Stack>
  );
}

function AccommodationSection({
  categories,
  settings,
  isLoading,
  onAddCategory,
  onAddOwnHousing,
  onAddDeposit,
  onEndVersion,
  onCancelVersion,
  onEditVersion,
}: {
  categories: Array<{
    key: string;
    name: string;
    media: number;
    accommodation: number;
    validFrom: string;
    validTo: string | null;
  }>;
  settings: PayrollSetting[];
  isLoading: boolean;
  onAddCategory: () => void;
  onAddOwnHousing: () => void;
  onAddDeposit: () => void;
  onEndVersion: (setting: PayrollSetting) => Promise<void>;
  onCancelVersion: (setting: PayrollSetting) => Promise<void>;
  onEditVersion: (setting: PayrollSetting) => void;
}) {
  const t = useTranslations();
  const ownHousing = settings.filter(
    (item) => item.settingKey === 'own_housing_allowance',
  );
  const deposits = settings.filter(
    (item) => item.settingKey === 'housing_deposit',
  );
  return (
    <Stack spacing={2.5}>
      <SectionHeading
        title={t.settings.accommodationSection.title}
        description={t.settings.accommodationSection.description}
      />
      <Card>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            px: 2.5,
            py: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6">
              {t.settings.accommodation.title}
            </Typography>
            <Typography color="text.secondary">
              {t.settings.accommodation.description}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAddCategory}
          >
            {t.settings.accommodation.add}
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.settings.accommodation.table.name}</TableCell>
                <TableCell align="right">
                  {t.settings.accommodation.table.media}
                </TableCell>
                <TableCell align="right">
                  {t.settings.accommodation.table.accommodation}
                </TableCell>
                <TableCell align="right">
                  {t.settings.accommodation.table.total}
                </TableCell>
                <TableCell>{t.settings.accommodation.table.validity}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <LoadingRows columns={6} />
              ) : (
                categories.map((category) => (
                  <TableRow hover key={`${category.key}:${category.validFrom}`}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {category.name}
                    </TableCell>
                    <TableCell align="right">
                      {currency.format(category.media)}
                    </TableCell>
                    <TableCell align="right">
                      {currency.format(category.accommodation)}
                    </TableCell>
                    <TableCell align="right">
                      {currency.format(category.media + category.accommodation)}
                    </TableCell>
                    <TableCell>
                      {category.validFrom} –{' '}
                      {category.validTo ?? t.settings.common.noEnd}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography variant="h6">
              {t.settings.accommodationSection.ownHousing}
            </Typography>
            <Typography color="text.secondary">
              {t.settings.accommodationSection.ownHousingDescription}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAddOwnHousing}
          >
            {t.settings.common.addVersion}
          </Button>
        </Stack>
        <SettingVersionList
          settings={ownHousing}
          onEnd={onEndVersion}
          onCancel={onCancelVersion}
          onEdit={onEditVersion}
        />
      </Card>
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography variant="h6">
              {t.settings.accommodationSection.housingDeposit}
            </Typography>
            <Typography color="text.secondary">
              {t.settings.accommodationSection.housingDepositDescription}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={onAddDeposit}
          >
            {t.settings.common.addVersion}
          </Button>
        </Stack>
        <SettingVersionList
          settings={deposits}
          onEnd={onEndVersion}
          onCancel={onCancelVersion}
          onEdit={onEditVersion}
        />
      </Card>
    </Stack>
  );
}

function AllowancesSection({
  settings,
  isLoading,
  onAdd,
  onEndVersion,
  onCancelVersion,
  onEditVersion,
}: {
  settings: PayrollSetting[];
  isLoading: boolean;
  onAdd: () => void;
  onEndVersion: (setting: PayrollSetting) => Promise<void>;
  onCancelVersion: (setting: PayrollSetting) => Promise<void>;
  onEditVersion: (setting: PayrollSetting) => void;
}) {
  const t = useTranslations();
  const businessSettings = settings.filter(
    (item) =>
      ![
        'accommodation_allowance',
        'company_housing_media',
        'own_housing_allowance',
        'housing_deposit',
      ].includes(item.settingKey),
  );
  const frequency = businessSettings
    .filter((item) => item.settingKey === 'frequency_bonus' && item.active)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  const scale = [
    [t.settings.allowancesSection.scale.zero, 400],
    [t.settings.allowancesSection.scale.one, 350],
    [t.settings.allowancesSection.scale.two, 300],
    [t.settings.allowancesSection.scale.three, 200],
    [t.settings.allowancesSection.scale.fourPlus, 0],
  ] as const;
  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <SectionHeading
          title={t.settings.allowancesSection.title}
          description={t.settings.allowancesSection.description}
        />
        <Button variant="contained" startIcon={<AddOutlined />} onClick={onAdd}>
          {t.settings.common.addVersion}
        </Button>
      </Stack>
      <Card sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: { sm: 'center' },
            }}
          >
            <Box>
              <Typography variant="h6">
                {t.settings.allowancesSection.attendanceBonus}
              </Typography>
              <Typography color="text.secondary">
                {t.settings.allowancesSection.attendanceBonusDescription}
              </Typography>
            </Box>
            <Chip
              color={frequency ? 'success' : 'warning'}
              label={
                frequency
                  ? `${t.settings.allowancesSection.activeConfiguration}: ${frequency.validFrom} – ${frequency.validTo ?? t.settings.common.noEnd}`
                  : t.settings.allowancesSection.missingConfiguration
              }
            />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t.settings.allowancesSection.missedDays}
                  </TableCell>
                  <TableCell align="right">
                    {t.settings.allowancesSection.bonus}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scale.map(([days, amount]) => (
                  <TableRow key={days}>
                    <TableCell>{days}</TableCell>
                    <TableCell align="right">
                      {currency.format(amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Card>
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.settings.common.description}</TableCell>
                <TableCell align="right">{t.settings.common.amount}</TableCell>
                <TableCell>{t.settings.settingForm.tax}</TableCell>
                <TableCell>{t.settings.common.validity}</TableCell>
                <TableCell>{t.organization.departments.table.status}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <LoadingRows columns={5} />
              ) : (
                businessSettings
                  .filter((item) => item.settingKey !== 'frequency_bonus')
                  .map((setting) => (
                    <BusinessSettingRow
                      key={setting.id}
                      setting={setting}
                      onEnd={onEndVersion}
                      onCancel={onCancelVersion}
                      onEdit={onEditVersion}
                    />
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {t.settings.allowancesSection.technicalData}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.settings.allowancesSection.technicalDescription}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t.settings.common.description}</TableCell>
                  <TableCell>{t.settings.common.validity}</TableCell>
                  <TableCell align="right">
                    {t.settings.common.amount}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {settings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell>
                      <Typography variant="body2">
                        {settingLabel(setting.settingKey, t)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {setting.settingKey}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {setting.validFrom} –{' '}
                      {setting.validTo ?? t.settings.common.noEnd}
                    </TableCell>
                    <TableCell align="right">
                      {currency.format(setting.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

function BusinessSettingRow({
  setting,
  onEnd,
  onCancel,
  onEdit,
}: {
  setting: PayrollSetting;
  onEnd: (setting: PayrollSetting) => Promise<void>;
  onCancel: (setting: PayrollSetting) => Promise<void>;
  onEdit: (setting: PayrollSetting) => void;
}) {
  const t = useTranslations();
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700 }}>
          {settingLabel(setting.settingKey, t)}
        </Typography>
        {setting.description ? (
          <Typography variant="caption" color="text.secondary">
            {setting.description}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell align="right">{currency.format(setting.amount)}</TableCell>
      <TableCell>{setting.taxType === 'NET' ? 'Netto' : 'Brutto'}</TableCell>
      <TableCell>
        {setting.validFrom} – {setting.validTo ?? t.settings.common.noEnd}
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          variant="outlined"
          color={setting.active ? 'success' : 'default'}
          label={
            setting.active
              ? t.settings.common.active
              : t.settings.common.inactive
          }
        />
      </TableCell>
      <TableCell align="right">
        <VersionActions
          setting={setting}
          onEnd={onEnd}
          onCancel={onCancel}
          onEdit={onEdit}
        />
      </TableCell>
    </TableRow>
  );
}

function SettingVersionList({
  settings,
  onEnd,
  onCancel,
  onEdit,
}: {
  settings: PayrollSetting[];
  onEnd: (setting: PayrollSetting) => Promise<void>;
  onCancel: (setting: PayrollSetting) => Promise<void>;
  onEdit: (setting: PayrollSetting) => void;
}) {
  const t = useTranslations();
  const currentMonth = currentPayrollMonthId(new Date());
  if (settings.length === 0)
    return (
      <Typography color="text.secondary" sx={{ mt: 2 }}>
        {t.settings.common.empty}
      </Typography>
    );
  return (
    <Stack spacing={1} sx={{ mt: 2 }}>
      {[...settings]
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
        .map((setting) => (
          <Stack
            key={setting.id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center' }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {currency.format(setting.amount)}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={setting.taxType === 'NET' ? 'Netto' : 'Brutto'}
            />
            <VersionActions
              setting={setting}
              onEnd={onEnd}
              onCancel={onCancel}
              onEdit={onEdit}
            />
            <Typography color="text.secondary">
              {setting.validFrom} – {setting.validTo ?? t.settings.common.noEnd}
            </Typography>
            <Chip
              size="small"
              color={
                payrollSettingLifecycleStatus(setting, currentMonth) ===
                'ACTIVE'
                  ? 'success'
                  : 'default'
              }
              label={
                t.settings.settingStatus[
                  payrollSettingLifecycleStatus(setting, currentMonth)
                ]
              }
            />
          </Stack>
        ))}
    </Stack>
  );
}

function VersionActions({
  setting,
  onEnd,
  onCancel,
  onEdit,
}: {
  setting: PayrollSetting;
  onEnd: (setting: PayrollSetting) => Promise<void>;
  onCancel: (setting: PayrollSetting) => Promise<void>;
  onEdit: (setting: PayrollSetting) => void;
}) {
  const t = useTranslations();
  const status = payrollSettingLifecycleStatus(
    setting,
    currentPayrollMonthId(new Date()),
  );
  return (
    <Stack direction="row" spacing={0.5}>
      {status !== 'CANCELLED' ? (
        <Button size="small" onClick={() => onEdit(setting)}>
          {t.settings.versionActions.edit}
        </Button>
      ) : null}
      {status === 'ACTIVE' ? (
        <Button size="small" onClick={() => void onEnd(setting)}>
          {t.settings.versionActions.end}
        </Button>
      ) : null}
      {status === 'FUTURE' ? (
        <Button
          size="small"
          color="error"
          onClick={() => void onCancel(setting)}
        >
          {t.settings.versionActions.cancel}
        </Button>
      ) : null}
    </Stack>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return Array.from({ length: 3 }, (_, row) => (
    <TableRow key={row}>
      {Array.from({ length: columns }, (__, column) => (
        <TableCell key={column}>
          <Skeleton />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function settingLabel(key: string, t: ReturnType<typeof useTranslations>) {
  const labels: Record<string, string> = {
    frequency_bonus: t.settings.allowancesSection.attendanceBonus,
    transport_allowance: t.settings.allowancesSection.labels.transport,
    udt_allowance: t.settings.allowancesSection.labels.udt,
    holiday_work_bonus: t.settings.allowancesSection.labels.holidayWork,
    laundry_allowance: t.settings.allowancesSection.labels.laundry,
    own_housing_allowance: t.settings.accommodationSection.ownHousing,
    accommodation_allowance: t.settings.accommodation.table.accommodation,
    company_housing_media: t.settings.accommodation.table.media,
    housing_deposit: t.settings.accommodationSection.housingDeposit,
  };
  return labels[key] ?? key;
}
