import CloseOutlined from '@mui/icons-material/CloseOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import {
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type { EmployeeStatusFilter } from './types';

interface EmployeesToolbarProps {
  search: string;
  status: EmployeeStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: EmployeeStatusFilter) => void;
}

export function EmployeesToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: EmployeesToolbarProps) {
  const t = useTranslations();

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5 }}>
      <TextField
        fullWidth
        label={t.employees.search.label}
        placeholder={t.employees.search.placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton
                  edge="end"
                  size="small"
                  aria-label={t.employees.search.clear}
                  onClick={() => onSearchChange('')}
                >
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />
      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_, value: EmployeeStatusFilter | null) => {
          if (value) onStatusChange(value);
        }}
        aria-label={t.employees.search.statusLabel}
        sx={{ minWidth: { sm: 210 }, alignSelf: { sm: 'center' } }}
      >
        <ToggleButton value="active">{t.employees.search.active}</ToggleButton>
        <ToggleButton value="archive">
          {t.employees.search.archive}
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
