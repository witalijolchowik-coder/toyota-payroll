import { TextField } from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type { MonthId } from '../../types/firestore';

interface MonthSelectorProps {
  monthId: MonthId;
  onChange: (monthId: MonthId) => void;
}

export function MonthSelector({ monthId, onChange }: MonthSelectorProps) {
  const t = useTranslations();

  return (
    <TextField
      type="month"
      label={t.settlement.monthSelector.label}
      value={monthId}
      onChange={(event) => {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
          onChange(event.target.value);
        }
      }}
      helperText={t.settlement.monthSelector.helper}
      sx={{ width: { xs: '100%', sm: 280 } }}
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}
