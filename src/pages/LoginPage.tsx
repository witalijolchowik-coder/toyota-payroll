import { useState, type FormEvent } from 'react';
import LockOutlined from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Navigate } from 'react-router-dom';

import { NoAccessScreen } from '../components/auth/NoAccessScreen';
import { useAuth } from '../hooks/useAuth';
import { useTranslations } from '../hooks/useTranslations';
import { routes } from '../utils/routes';

export function LoginPage() {
  const t = useTranslations();
  const { status, isAuthenticated, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={routes.dashboard} replace />;
  }

  if (status === 'no-access') {
    return <NoAccessScreen />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFailed(false);
    try {
      await signIn(email, password);
    } catch {
      setFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 3,
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ width: 'min(100%, 440px)', p: 4 }}>
        <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            <LockOutlined color="primary" sx={{ fontSize: 42 }} />
            <Typography variant="h4">{t.auth.login.title}</Typography>
            <Typography color="text.secondary">
              {t.auth.login.description}
            </Typography>
          </Stack>

          {status === 'configuration-error' ? (
            <Alert severity="error">{t.auth.errors.configuration}</Alert>
          ) : null}

          {failed ? (
            <Alert severity="error">{t.auth.errors.invalidCredentials}</Alert>
          ) : null}

          <TextField
            type="email"
            label={t.auth.login.email}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={isSubmitting}
          />
          <TextField
            type="password"
            label={t.auth.login.password}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || status === 'configuration-error'}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {isSubmitting ? t.auth.login.signingIn : t.auth.login.submit}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
