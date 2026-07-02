import type { ReactNode } from 'react';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';

interface DashboardCardProps {
  title: string;
  value: string;
  helperText: string;
  icon: ReactNode;
  gridColumn?: string;
}

function DashboardCard({
  title,
  value,
  helperText,
  icon,
  gridColumn,
}: DashboardCardProps) {
  return (
    <Card sx={{ gridColumn }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between' }}
        >
          <Box>
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{ fontWeight: 650 }}
            >
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 1.5 }}>
              {value}
            </Typography>
          </Box>
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
        </Stack>
        <Typography color="text.secondary" variant="caption">
          {helperText}
        </Typography>
      </CardContent>
    </Card>
  );
}

function LatestImportsCard() {
  return (
    <Card sx={{ gridColumn: { xs: 'auto', lg: 'span 2' } }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <Typography variant="h6">Latest Imports</Typography>
            <Typography color="text.secondary" variant="body2">
              Recent attendance and absence files will appear here.
            </Typography>
          </div>
          <CloudUploadOutlined color="primary" />
        </Stack>
        <Divider sx={{ my: 2.5 }} />
        <Stack spacing={2}>
          {[68, 54, 61].map((width) => (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center' }}
              key={width}
            >
              <Skeleton variant="rounded" width={36} height={36} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton width={`${width}%`} />
                <Skeleton width="34%" height={16} />
              </Box>
              <Skeleton variant="rounded" width={72} height={24} />
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  return (
    <Stack spacing={4}>
      <PageHeader
        eyebrow="Coordinator workspace"
        title="Dashboard"
        description="Your monthly payroll overview will live here. The shell is ready; live data and business workflows will be connected in later steps."
        action={
          <Chip
            icon={<TaskAltOutlined />}
            label="Application shell ready"
            color="success"
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
        <DashboardCard
          title="Current Absences"
          value="—"
          helperText="No absence data connected"
          icon={<EventBusyOutlined />}
        />
        <DashboardCard
          title="Active Employees"
          value="—"
          helperText="Employee module not started"
          icon={<GroupsOutlined />}
        />
        <DashboardCard
          title="Pending Reviews"
          value="—"
          helperText="Review workflow not connected"
          icon={<PendingActionsOutlined />}
        />
        <DashboardCard
          title="Payroll Status"
          value="Not started"
          helperText="Monthly settlement will appear here"
          icon={<TaskAltOutlined />}
        />
        <LatestImportsCard />
        <Card sx={{ gridColumn: { xs: 'auto', lg: 'span 2' } }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">Payroll Status</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              Period progress and validation status will appear here.
            </Typography>
            <Box
              sx={{
                mt: 3,
                minHeight: 124,
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 2.5,
              }}
            >
              <Typography color="text.secondary" variant="body2">
                No payroll period selected
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
