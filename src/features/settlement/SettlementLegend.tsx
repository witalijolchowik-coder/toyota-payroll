import { Box, Stack, Typography } from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';

export function SettlementLegend() {
  const t = useTranslations();
  const entries = [
    {
      label: t.settlement.legend.workingDay,
      color: 'background.paper',
      border: 'divider',
    },
    {
      label: t.settlement.legend.weekend,
      color: 'action.hover',
      border: 'divider',
    },
    {
      label: t.settlement.legend.publicHoliday,
      color: 'error.light',
      border: 'error.main',
    },
    {
      label: t.settlement.legend.futureDay,
      color: 'action.disabledBackground',
      border: 'divider',
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
                opacity:
                  entry.label === t.settlement.legend.publicHoliday ? 0.4 : 1,
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
      </Stack>
    </Stack>
  );
}
