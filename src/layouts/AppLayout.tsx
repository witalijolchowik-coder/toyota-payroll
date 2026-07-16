import { Box, Container, Toolbar } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';

import { AppTopBar } from '../components/navigation/AppTopBar';
import {
  collapsedDrawerWidth,
  expandedDrawerWidth,
  NavigationDrawer,
} from '../components/navigation/NavigationDrawer';
import { getNavigationItem } from '../config/navigation';
import { useNavigationDrawer } from '../hooks/useNavigationDrawer';
import { routes } from '../utils/routes';

export function AppLayout() {
  const location = useLocation();
  const navigation = useNavigationDrawer();
  const currentItem = getNavigationItem(location.pathname);
  const drawerWidth = navigation.desktopCollapsed
    ? collapsedDrawerWidth
    : expandedDrawerWidth;
  const usesWideWorkspace =
    location.pathname === routes.settlement ||
    location.pathname === routes.settings;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppTopBar
        pageTitle={currentItem?.label ?? 'Workspace'}
        desktopCollapsed={navigation.desktopCollapsed}
        onOpenMobileDrawer={navigation.openMobileDrawer}
        onToggleDesktopDrawer={navigation.toggleDesktopDrawer}
      />
      <NavigationDrawer
        mobileOpen={navigation.mobileOpen}
        desktopCollapsed={navigation.desktopCollapsed}
        onMobileClose={navigation.closeMobileDrawer}
      />

      <Box
        component="main"
        sx={{
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
          flexGrow: 1,
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 60, sm: 68 } }} />
        <Container
          maxWidth={usesWideWorkspace ? false : 'xl'}
          sx={{
            px: usesWideWorkspace
              ? { xs: 1.5, sm: 2, lg: 2.5 }
              : { xs: 2, sm: 3, lg: 4 },
            py: { xs: 2, sm: usesWideWorkspace ? 2.5 : 4 },
          }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
