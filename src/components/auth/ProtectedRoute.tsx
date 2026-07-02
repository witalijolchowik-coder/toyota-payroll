import LockOutlined from '@mui/icons-material/LockOutlined';
import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

export function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') {
    return (
      <Box
        component="main"
        sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
      >
        <CircularProgress aria-label="Checking authentication" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box
        component="main"
        sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}
      >
        <Paper sx={{ width: 'min(100%, 480px)', p: 4 }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <LockOutlined color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5">Authentication required</Typography>
            <Typography color="text.secondary">
              Sign-in will be connected in a future implementation step.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return <Outlet />;
}
