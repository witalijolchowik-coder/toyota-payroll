import CloseOutlined from '@mui/icons-material/CloseOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import {
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
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
      <FormControl sx={{ minWidth: { sm: 180 } }}>
        <InputLabel id="employee-status-filter-label">
          {t.employees.search.statusLabel}
        </InputLabel>
        <Select
          labelId="employee-status-filter-label"
          value={status}
          label={t.employees.search.statusLabel}
          onChange={(event) =>
            onStatusChange(event.target.value as EmployeeStatusFilter)
          }
        >
          <MenuItem value="all">{t.employees.search.all}</MenuItem>
          <MenuItem value="active">{t.employees.search.active}</MenuItem>
          <MenuItem value="inactive">{t.employees.search.inactive}</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
