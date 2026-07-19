import { Box, MenuItem, Typography } from '@mui/material';

import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';
import type { AbsenceCode } from '../../utils/absences';
import { appearanceKeyForAbsence } from '../../utils/calendarAppearance';

interface AbsenceOptionContentProps {
  code: AbsenceCode;
  description: string;
}

type AbsenceMenuItemProps = AbsenceOptionContentProps;

export function AbsenceOptionContent({
  code,
  description,
}: AbsenceOptionContentProps) {
  const { palette } = useCalendarAppearance();
  const colors = palette[appearanceKeyForAbsence(code)];

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        gap: 1.25,
        minWidth: 0,
        width: '100%',
      }}
    >
      <Box
        component="span"
        data-testid={`absence-code-${code}`}
        sx={{
          alignItems: 'center',
          bgcolor: colors.background,
          borderRadius: 1,
          color: colors.text,
          display: 'inline-flex',
          flex: '0 0 auto',
          fontSize: '0.8125rem',
          fontWeight: 800,
          justifyContent: 'center',
          lineHeight: 1,
          minHeight: 28,
          minWidth: 42,
          px: 1,
        }}
      >
        {code}
      </Box>
      <Typography
        component="span"
        variant="body2"
        color="text.primary"
        noWrap
        sx={{ minWidth: 0 }}
      >
        {description}
      </Typography>
    </Box>
  );
}

export function AbsenceMenuItem({ code, description }: AbsenceMenuItemProps) {
  return (
    <MenuItem value={code} sx={{ minHeight: 44 }}>
      <AbsenceOptionContent code={code} description={description} />
    </MenuItem>
  );
}
