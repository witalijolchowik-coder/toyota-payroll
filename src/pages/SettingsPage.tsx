import { useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { DepartmentFormDialog } from '../features/settings/DepartmentFormDialog';
import { PayrollSettingFormDialog } from '../features/settings/PayrollSettingFormDialog';
import { useDepartments } from '../features/settings/useDepartments';
import { usePayrollSettings } from '../features/settings/usePayrollSettings';
import { useNotification } from '../hooks/useNotification';
import { useTranslations } from '../hooks/useTranslations';
import type {
  Department,
  DepartmentCreateInput,
  DepartmentUpdateInput,
  PayrollSetting,
  PayrollSettingCreateInput,
} from '../types/firestore';

const currency = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

const settingLabels: Record<string, string> = {
  frequency_bonus: 'Premia frekwencyjna',
  transport_allowance: 'Dodatek transportowy',
  accommodation_allowance: 'Zakwaterowanie',
  udt_allowance: 'Dodatek UDT',
};

type DepartmentFormState =
  { mode: 'add' } | { mode: 'edit'; department: Department } | null;

export function SettingsPage() {
  const t = useTranslations();
  const { settings, isLoading, error, createVersion } = usePayrollSettings();
  const {
    departments,
    isLoading: areDepartmentsLoading,
    error: departmentsError,
    addDepartment,
    editDepartment,
  } = useDepartments();
  const { notify } = useNotification();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [departmentFormState, setDepartmentFormState] =
    useState<DepartmentFormState>(null);

  const handleCreate = async (input: PayrollSettingCreateInput) => {
    await createVersion(input);
    notify({
      message: 'Nowa wersja ustawienia została zapisana.',
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

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Konfiguracja globalna"
        title="Ustawienia płacowe"
        description="Wersjonowane stawki wspólne dla całego systemu. Dodanie nowej wersji nie zmienia rozliczonych miesięcy."
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setIsFormOpen(true)}
          >
            Dodaj wersję
          </Button>
        }
      />

      <Alert severity="info">
        Ustawienia są zapisywane historycznie. Payroll Engine będzie wybierał
        najnowszą wersję obowiązującą w wybranym miesiącu.
      </Alert>

      {error ? (
        <Alert severity="error">
          Nie udało się wczytać ustawień płacowych. Sprawdź konfigurację
          Firebase i uprawnienia.
        </Alert>
      ) : null}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ustawienie</TableCell>
                <TableCell>Typ</TableCell>
                <TableCell align="right">Kwota</TableCell>
                <TableCell>Ważność</TableCell>
                <TableCell>Opis</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }, (__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : settings.map((setting) => (
                    <PayrollSettingRow key={setting.id} setting={setting} />
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!isLoading && settings.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
            <Typography variant="h6">Brak ustawień płacowych</Typography>
            <Typography color="text.secondary">
              Dodaj pierwszą wersję stawki, aby przygotować konfigurację dla
              przyszłego Payroll Engine.
            </Typography>
          </Box>
        ) : null}
      </Card>

      {departmentsError ? (
        <Alert severity="error">
          <strong>{t.organization.departments.loadTitle}</strong>
          <br />
          {t.organization.departments.loadDescription}
        </Alert>
      ) : null}

      <Card>
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            gap: 2,
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Typography variant="h6">
              {t.organization.departments.settingsTitle}
            </Typography>
            <Typography color="text.secondary">
              {t.organization.departments.settingsDescription}
            </Typography>
          </div>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={() => setDepartmentFormState({ mode: 'add' })}
          >
            {t.organization.departments.add}
          </Button>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.organization.departments.table.name}</TableCell>
                <TableCell>
                  {t.organization.departments.table.shiftMode}
                </TableCell>
                <TableCell>{t.organization.departments.table.status}</TableCell>
                <TableCell align="right">
                  {t.organization.departments.table.actions}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {areDepartmentsLoading
                ? Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 4 }, (__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : departments.map((department) => (
                    <TableRow hover key={department.id}>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>
                          {department.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {department.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {t.organization.shiftModes[department.shiftMode]}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            department.active
                              ? t.organization.departments.status.active
                              : t.organization.departments.status.inactive
                          }
                          color={department.active ? 'success' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={t.organization.departments.table.edit}
                          onClick={() =>
                            setDepartmentFormState({
                              mode: 'edit',
                              department,
                            })
                          }
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!areDepartmentsLoading && departments.length === 0 ? (
          <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
            <Typography variant="h6">
              {t.organization.departments.emptyTitle}
            </Typography>
            <Typography color="text.secondary">
              {t.organization.departments.emptyDescription}
            </Typography>
          </Box>
        ) : null}
      </Card>

      {isFormOpen ? (
        <PayrollSettingFormDialog
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreate}
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
    </Stack>
  );
}

function PayrollSettingRow({ setting }: { setting: PayrollSetting }) {
  return (
    <TableRow hover>
      <TableCell>
        <Typography sx={{ fontWeight: 700 }}>
          {settingLabels[setting.settingKey] ?? setting.settingKey}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {setting.settingKey}
        </Typography>
      </TableCell>
      <TableCell>{setting.variantName ?? '—'}</TableCell>
      <TableCell align="right">{currency.format(setting.amount)}</TableCell>
      <TableCell>
        {setting.validFrom} – {setting.validTo ?? 'bezterminowo'}
      </TableCell>
      <TableCell sx={{ maxWidth: 320 }}>
        <Typography variant="body2" noWrap title={setting.description}>
          {setting.description || '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={setting.active ? 'Aktywna' : 'Nieaktywna'}
          color={setting.active ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      </TableCell>
    </TableRow>
  );
}
