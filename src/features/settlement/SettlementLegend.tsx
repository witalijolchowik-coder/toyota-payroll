import { Box, Stack, Typography } from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';

export function SettlementLegend() {
  const t = useTranslations();
  const { palette } = useCalendarAppearance();
  const entries = [
    {
      label: t.settlement.legend.workingDay,
      color: palette.worked.background,
      border: palette.worked.text,
    },
    {
      label: t.settlement.legend.weekend,
      color: palette.weekend.background,
      border: palette.weekend.text,
    },
    {
      label: t.settlement.legend.publicHoliday,
      color: palette.publicHoliday.background,
      border: palette.publicHoliday.text,
    },
    {
      label: t.settlement.legend.futureDay,
      color: palette.future.background,
      border: palette.future.text,
    },
  ] as const;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{t.settlement.legend.title}</Typography>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
        {entries.map((entry) => (
          <Stack
            key={entry.label}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: 'center' }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 16,
                height: 16,
                borderRadius: 0.75,
                bgcolor: entry.color,
                border: 1,
                borderColor: entry.border,
                opacity: 1,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {entry.label}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography
            variant="caption"
            sx={{ minWidth: 16, color: 'text.secondary', fontStyle: 'italic' }}
          >
            {t.settlement.legend.virtualDefaultValue}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t.settlement.legend.virtualDefault}
          </Typography>
        </Stack>
        <LegendValue
          value="7,5"
          label={t.settlement.legend.manualValue}
          sx={{
            color: palette.manualCorrection.text,
            textDecoration: 'underline',
          }}
        />
        <LegendValue
          value="7,5"
          label={t.settlement.legend.importedValue}
          sx={{ color: palette.worked.text, fontWeight: 700 }}
        />
        <LegendValue
          value="7,5"
          label={t.settlement.legend.importedOverride}
          sx={{
            color: palette.manualCorrection.text,
            fontWeight: 800,
            textDecoration: 'underline',
          }}
        />
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 16,
              height: 16,
              borderRadius: 0.75,
              boxShadow: `inset 0 0 0 2px ${palette.warning.text}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {t.settlement.legend.warning}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}

function LegendValue({
  value,
  label,
  sx,
}: {
  value: string;
  label: string;
  sx: Record<string, string | number>;
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" sx={{ minWidth: 20, ...sx }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
