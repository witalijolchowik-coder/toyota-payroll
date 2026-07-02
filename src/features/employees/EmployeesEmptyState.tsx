import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import { Box, Stack, Typography } from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';

interface EmployeesEmptyStateProps {
  filtered: boolean;
}

export function EmployeesEmptyState({ filtered }: EmployeesEmptyStateProps) {
  const t = useTranslations();
  const Icon = filtered ? SearchOffOutlined : GroupsOutlined;

  return (
    <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
        <Icon color="disabled" sx={{ fontSize: 48 }} />
        <Typography variant="h6">
          {filtered ? t.employees.empty.filteredTitle : t.employees.empty.title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
          {filtered
            ? t.employees.empty.filteredDescription
            : t.employees.empty.description}
        </Typography>
      </Stack>
    </Box>
  );
}
