import { Link as RouterLink } from 'react-router-dom';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { useTranslations } from '../hooks/useTranslations';
import { routes } from '../utils/routes';

export function ReportsPage() {
  const t = useTranslations();

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={t.reports.page.eyebrow}
        title={t.reports.page.title}
        description={t.reports.page.description}
        action={
          <Button
            component={RouterLink}
            to={routes.settlement}
            variant="contained"
            startIcon={<AssessmentOutlined />}
          >
            {t.reports.actions.settlement}
          </Button>
        }
      />

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={2}>
            <SummarizeOutlined color="primary" />
            <div>
              <Typography variant="h6">
                {t.reports.currentState.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {t.reports.currentState.description}
              </Typography>
            </div>
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info">
        <strong>{t.reports.limitations.title}</strong>
        <br />
        {t.reports.limitations.first}
        <br />
        {t.reports.limitations.second}
      </Alert>
    </Stack>
  );
}
