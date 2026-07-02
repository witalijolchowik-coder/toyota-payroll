import ChevronLeft from '@mui/icons-material/ChevronLeft';
import Menu from '@mui/icons-material/Menu';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';

import { useAuth } from '../../hooks/useAuth';

interface AppTopBarProps {
  pageTitle: string;
  desktopCollapsed: boolean;
  onOpenMobileDrawer: () => void;
  onToggleDesktopDrawer: () => void;
}

export function AppTopBar({
  pageTitle,
  desktopCollapsed,
  onOpenMobileDrawer,
  onToggleDesktopDrawer,
}: AppTopBarProps) {
  const { user } = useAuth();
  const initials = user?.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 60, sm: 68 } }}>
        <IconButton
          edge="start"
          aria-label="Open navigation"
          onClick={onOpenMobileDrawer}
          sx={{ display: { md: 'none' }, mr: 1 }}
        >
          <Menu />
        </IconButton>
        <Tooltip
          title={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <IconButton
            edge="start"
            aria-label={
              desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'
            }
            onClick={onToggleDesktopDrawer}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, mr: 1.5 }}
          >
            {desktopCollapsed ? <Menu /> : <ChevronLeft />}
          </IconButton>
        </Tooltip>

        <Stack
          direction="row"
          spacing={1.25}
          sx={{ minWidth: 0, alignItems: 'center' }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 32,
              height: 32,
              flex: '0 0 auto',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 850,
            }}
          >
            T
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: 'text.secondary', lineHeight: 1.2 }}
            >
              Toyota Payroll
            </Typography>
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.25 }}>
              {pageTitle}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Notifications">
          <IconButton aria-label="Notifications">
            <NotificationsNoneOutlined />
          </IconButton>
        </Tooltip>
        <Tooltip title={user?.displayName ?? 'Current user'}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              ml: 1,
              bgcolor: 'secondary.main',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
