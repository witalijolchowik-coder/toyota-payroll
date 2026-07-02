import type { ComponentType } from 'react';
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  SvgIcon,
  type SvgIconProps,
  Typography,
} from '@mui/material';

import { PageHeader } from '../layout/PageHeader';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: ComponentType<SvgIconProps>;
}

export function ModulePlaceholder({
  title,
  description,
  icon,
}: ModulePlaceholderProps) {
  return (
    <Stack spacing={4}>
      <PageHeader
        eyebrow="Application module"
        title={title}
        description={description}
      />

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Box
            sx={{
              minHeight: 300,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
            }}
          >
            <Stack spacing={2} sx={{ maxWidth: 480, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 3,
                  color: 'primary.main',
                  bgcolor: 'primary.main',
                  backgroundColor:
                    'color-mix(in srgb, currentColor 10%, transparent)',
                }}
              >
                <SvgIcon component={icon} sx={{ fontSize: 34 }} />
              </Box>
              <Chip
                icon={<ConstructionOutlined />}
                label="Prepared for a future step"
                size="small"
                variant="outlined"
              />
              <Typography variant="h5">Workspace ready</Typography>
              <Typography color="text.secondary">
                Navigation, responsive layout, shared providers, and service
                boundaries are in place. Business functionality has not been
                started.
              </Typography>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
