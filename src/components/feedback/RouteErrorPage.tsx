import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useRouteError } from 'react-router-dom';

import { routes } from '../../utils/routes';

export function RouteErrorPage() {
  const error = useRouteError();

  console.error('Route rendering error', error);

  return (
    <Box
      component="main"
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}
    >
      <Paper sx={{ width: 'min(100%, 520px)', p: { xs: 3, sm: 5 } }}>
        <Stack spacing={2.5} sx={{ alignItems: 'flex-start' }}>
          <ErrorOutlined color="error" sx={{ fontSize: 44 }} />
          <div>
            <Typography variant="h5" gutterBottom>
              This page could not be displayed
            </Typography>
            <Typography color="text.secondary">
              Return to the dashboard and try the action again.
            </Typography>
          </div>
          <Button
            component={RouterLink}
            to={routes.dashboard}
            startIcon={<HomeOutlined />}
            variant="contained"
          >
            Go to dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
