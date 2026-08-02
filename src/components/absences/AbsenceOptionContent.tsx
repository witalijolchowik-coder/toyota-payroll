import { forwardRef } from 'react';
import { Box, MenuItem, type MenuItemProps, Typography } from '@mui/material';

import { useCalendarAppearance } from '../../hooks/useCalendarAppearance';
import type { AbsenceCode } from '../../utils/absences';
import { appearanceKeyForAbsence } from '../../utils/calendarAppearance';

interface AbsenceOptionContentProps {
  code: AbsenceCode;
  description: string;
}

type AbsenceMenuItemProps = AbsenceOptionContentProps &
  Omit<MenuItemProps, 'value'>;

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

export const AbsenceMenuItem = forwardRef<HTMLLIElement, AbsenceMenuItemProps>(
  function AbsenceMenuItem({ code, description, sx, ...menuItemProps }, ref) {
    return (
      <MenuItem
        {...menuItemProps}
        ref={ref}
        value={code}
        sx={[{ minHeight: 44 }, ...(Array.isArray(sx) ? sx : [sx])].filter(
          Boolean,
        )}
      >
        <AbsenceOptionContent code={code} description={description} />
      </MenuItem>
    );
  },
);
