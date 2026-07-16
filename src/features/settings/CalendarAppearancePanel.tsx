import { useState } from 'react';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';
import { useNotification } from '../../hooks/useNotification';
import { useTranslations } from '../../hooks/useTranslations';
import {
  CALENDAR_APPEARANCE_KEYS,
  DEFAULT_CALENDAR_APPEARANCE,
  hasLowCalendarContrast,
  isHexColor,
  resetCalendarAppearanceState,
  type CalendarAppearanceKey,
  type CalendarAppearancePalette,
} from '../../utils/calendarAppearance';

export function CalendarAppearancePanel() {
  const t = useTranslations();
  const { notify } = useNotification();
  const { palette, isLoading, error, savePalette } = useCalendarAppearance();
  const [draftOverride, setDraftOverride] =
    useState<CalendarAppearancePalette | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const draft = draftOverride ?? palette;

  const changeColor = (
    key: CalendarAppearanceKey,
    field: 'text' | 'background',
    value: string,
  ) => {
    setDraftOverride((currentOverride) => {
      const current = currentOverride ?? palette;
      return {
        ...current,
        [key]: { ...current[key], [field]: value.toUpperCase() },
      };
    });
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await savePalette(draft);
      setDraftOverride(null);
      notify({
        message: t.settings.interface.palette.saved,
        severity: 'success',
      });
    } catch {
      notify({
        message: t.settings.interface.palette.saveFailed,
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5">{t.settings.interface.title}</Typography>
        <Typography color="text.secondary">
          {t.settings.interface.description}
        </Typography>
      </Box>
      {error ? (
        <Alert severity="warning">
          {t.settings.interface.palette.loadFailed}
        </Alert>
      ) : null}
      <Alert severity="info">{t.settings.interface.palette.priority}</Alert>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography variant="h6">
                  {t.settings.interface.palette.title}
                </Typography>
                <Typography color="text.secondary">
                  {t.settings.interface.palette.description}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<RestartAltOutlined />}
                  onClick={() => setDraftOverride(DEFAULT_CALENDAR_APPEARANCE)}
                  disabled={isLoading || isSaving}
                >
                  {t.settings.interface.palette.resetAll}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveOutlined />}
                  onClick={() => void save()}
                  disabled={isLoading || isSaving}
                >
                  {isSaving
                    ? t.settings.interface.palette.saving
                    : t.settings.interface.palette.save}
                </Button>
              </Stack>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              {CALENDAR_APPEARANCE_KEYS.map((key) => (
                <PaletteRow
                  key={key}
                  paletteKey={key}
                  colors={draft[key]}
                  onChange={changeColor}
                  onReset={() =>
                    setDraftOverride((currentOverride) =>
                      resetCalendarAppearanceState(
                        currentOverride ?? palette,
                        key,
                      ),
                    )
                  }
                />
              ))}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function PaletteRow({
  paletteKey,
  colors,
  onChange,
  onReset,
}: {
  paletteKey: CalendarAppearanceKey;
  colors: CalendarAppearancePalette[CalendarAppearanceKey];
  onChange: (
    key: CalendarAppearanceKey,
    field: 'text' | 'background',
    value: string,
  ) => void;
  onReset: () => void;
}) {
  const t = useTranslations();
  const lowContrast = hasLowCalendarContrast(colors);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: lowContrast ? 'warning.main' : 'divider',
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {t.settings.interface.palette.states[paletteKey]}
            </Typography>
            {lowContrast ? (
              <Typography variant="caption" color="warning.dark">
                {t.settings.interface.palette.lowContrast}
              </Typography>
            ) : null}
          </Box>
          <Box
            aria-label={`${t.settings.interface.palette.preview}: ${t.settings.interface.palette.states[paletteKey]}`}
            sx={{
              minWidth: 52,
              height: 38,
              px: 1,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1.25,
              border: 1,
              borderColor: 'divider',
              color: colors.text,
              bgcolor: colors.background,
              fontWeight: 800,
              fontSize: '0.75rem',
            }}
          >
            {t.settings.interface.palette.samples[paletteKey]}
          </Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <ColorField
            label={t.settings.interface.palette.textColor}
            value={colors.text}
            onChange={(value) => onChange(paletteKey, 'text', value)}
          />
          <ColorField
            label={t.settings.interface.palette.backgroundColor}
            value={colors.background}
            onChange={(value) => onChange(paletteKey, 'background', value)}
          />
          <Button size="small" onClick={onReset} sx={{ flexShrink: 0 }}>
            {t.settings.interface.palette.reset}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: 'center', flex: 1 }}
    >
      <Box
        component="input"
        type="color"
        aria-label={label}
        value={isHexColor(value) ? value : '#000000'}
        onChange={(event) => onChange(event.target.value)}
        sx={{ width: 38, height: 38, border: 0, p: 0, bgcolor: 'transparent' }}
      />
      <TextField
        label={label}
        size="small"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={!isHexColor(value)}
        slotProps={{ htmlInput: { maxLength: 7 } }}
        sx={{ minWidth: 116, flex: 1 }}
      />
    </Stack>
  );
}
