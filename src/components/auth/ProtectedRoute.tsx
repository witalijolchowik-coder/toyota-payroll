import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';

import { NoAccessScreen } from './NoAccessScreen';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../hooks/useTranslations';
import { routes } from '../../utils/routes';

export function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();
  const t = useTranslations();

  if (status === 'loading') {
    return (
      <Box
        component="main"
        sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
      >
        <CircularProgress aria-label={t.auth.loading} />
      </Box>
    );
  }

  if (status === 'no-access') {
    return <NoAccessScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace />;
  }

  return <Outlet />;
}
