import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { routes } from '../utils/routes';

export function NotFoundPage() {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 800 }}
          >
            404
          </Typography>
          <Typography component="h1" variant="h4">
            Page not found
          </Typography>
          <Typography color="text.secondary">
            The requested workspace does not exist.
          </Typography>
          <Button
            component={RouterLink}
            to={routes.dashboard}
            startIcon={<ArrowBackOutlined />}
            variant="contained"
          >
            Return to dashboard
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
