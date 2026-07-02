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

export function AppLayout() {
  const location = useLocation();
  const navigation = useNavigationDrawer();
  const currentItem = getNavigationItem(location.pathname);
  const drawerWidth = navigation.desktopCollapsed
    ? collapsedDrawerWidth
    : expandedDrawerWidth;

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
          maxWidth="xl"
          sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 3, sm: 4 } }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
