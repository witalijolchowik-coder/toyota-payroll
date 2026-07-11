import BlockOutlined from '@mui/icons-material/BlockOutlined';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';

import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../hooks/useTranslations';

export function NoAccessScreen() {
  const t = useTranslations();
  const { signOut } = useAuth();

  return (
    <Box
      component="main"
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}
    >
      <Paper sx={{ width: 'min(100%, 480px)', p: 4 }}>
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <BlockOutlined color="warning" sx={{ fontSize: 42 }} />
          <Typography variant="h5">{t.auth.noAccess.title}</Typography>
          <Typography color="text.secondary">
            {t.auth.noAccess.description}
          </Typography>
          <Button variant="outlined" onClick={() => void signOut()}>
            {t.auth.signOut}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
