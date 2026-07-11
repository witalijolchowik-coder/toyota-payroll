import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { useTranslations } from '../hooks/useTranslations';
import { routes } from '../utils/routes';

interface ReadinessCardProps {
  title: string;
  value: string;
  helperText: string;
  icon: ReactNode;
}

function ReadinessCard({
  title,
  value,
  helperText,
  icon,
}: ReadinessCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
              borderRadius: 2.5,
              bgcolor: 'action.hover',
              color: 'primary.main',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{ fontWeight: 650 }}
            >
              {title}
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.75 }}>
              {value}
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
              {helperText}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const t = useTranslations();

  return (
    <Stack spacing={4}>
      <PageHeader
        eyebrow={t.dashboard.page.eyebrow}
        title={t.dashboard.page.title}
        description={t.dashboard.page.description}
        action={
          <Chip
            icon={<TaskAltOutlined />}
            label={t.dashboard.page.status}
            color="warning"
            variant="outlined"
          />
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 2.5,
        }}
      >
        <ReadinessCard
          title={t.dashboard.cards.employees.title}
          value={t.dashboard.cards.employees.value}
          helperText={t.dashboard.cards.employees.helper}
          icon={<GroupsOutlined />}
        />
        <ReadinessCard
          title={t.dashboard.cards.month.title}
          value={t.dashboard.cards.month.value}
          helperText={t.dashboard.cards.month.helper}
          icon={<AssessmentOutlined />}
        />
        <ReadinessCard
          title={t.dashboard.cards.absences.title}
          value={t.dashboard.cards.absences.value}
          helperText={t.dashboard.cards.absences.helper}
          icon={<EventBusyOutlined />}
        />
        <ReadinessCard
          title={t.dashboard.cards.exports.title}
          value={t.dashboard.cards.exports.value}
          helperText={t.dashboard.cards.exports.helper}
          icon={<SummarizeOutlined />}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6">{t.dashboard.workflow.title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {t.dashboard.workflow.description}
          </Typography>
          <Stack spacing={1.25} sx={{ mt: 2.5 }}>
            <Typography>{t.dashboard.workflow.employees}</Typography>
            <Typography>{t.dashboard.workflow.settings}</Typography>
            <Typography>{t.dashboard.workflow.month}</Typography>
            <Typography>{t.dashboard.workflow.absences}</Typography>
            <Typography>{t.dashboard.workflow.review}</Typography>
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mt: 3, flexWrap: 'wrap' }}
          >
            <Button component={RouterLink} to={routes.employees}>
              {t.dashboard.actions.employees}
            </Button>
            <Button
              component={RouterLink}
              to={routes.settings}
              startIcon={<SettingsOutlined />}
            >
              {t.dashboard.actions.settings}
            </Button>
            <Button
              component={RouterLink}
              to={routes.settlement}
              variant="contained"
            >
              {t.dashboard.actions.settlement}
            </Button>
            <Button component={RouterLink} to={routes.absences}>
              {t.dashboard.actions.absences}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
