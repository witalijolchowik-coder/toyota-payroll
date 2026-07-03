import { useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
import { PayrollSettingFormDialog } from '../features/settings/PayrollSettingFormDialog';
import { usePayrollSettings } from '../features/settings/usePayrollSettings';
import { useNotification } from '../hooks/useNotification';
import type {
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

export function SettingsPage() {
  const { settings, isLoading, error, createVersion } = usePayrollSettings();
  const { notify } = useNotification();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleCreate = async (input: PayrollSettingCreateInput) => {
    await createVersion(input);
    notify({
      message: 'Nowa wersja ustawienia została zapisana.',
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

      {isFormOpen ? (
        <PayrollSettingFormDialog
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreate}
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
