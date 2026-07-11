import ChevronLeft from '@mui/icons-material/ChevronLeft';
import Menu from '@mui/icons-material/Menu';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';

import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../hooks/useTranslations';

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
  const { user, signOut } = useAuth();
  const t = useTranslations();
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
          aria-label={t.auth.appBar.openNavigation}
          onClick={onOpenMobileDrawer}
          sx={{ display: { md: 'none' }, mr: 1 }}
        >
          <Menu />
        </IconButton>
        <Tooltip
          title={
            desktopCollapsed
              ? t.auth.appBar.expandNavigation
              : t.auth.appBar.collapseNavigation
          }
        >
          <IconButton
            edge="start"
            aria-label={
              desktopCollapsed
                ? t.auth.appBar.expandNavigation
                : t.auth.appBar.collapseNavigation
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

        <Tooltip title={t.auth.appBar.notifications}>
          <IconButton aria-label={t.auth.appBar.notifications}>
            <NotificationsNoneOutlined />
          </IconButton>
        </Tooltip>
        <Tooltip title={user?.displayName ?? t.auth.appBar.currentUser}>
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
        <Button
          variant="text"
          color="inherit"
          onClick={() => void signOut()}
          sx={{ ml: 1, display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {t.auth.signOut}
        </Button>
      </Toolbar>
    </AppBar>
  );
}
