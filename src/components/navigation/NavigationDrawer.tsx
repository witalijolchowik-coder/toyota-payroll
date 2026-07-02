import { Box, Divider, Drawer, List, Toolbar, Typography } from '@mui/material';

import {
  primaryNavigation,
  secondaryNavigation,
} from '../../config/navigation';
import { NavigationListItem } from './NavigationListItem';

export const expandedDrawerWidth = 272;
export const collapsedDrawerWidth = 80;

interface NavigationDrawerProps {
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onMobileClose: () => void;
}

function DrawerContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 60, sm: 68 } }} />
      <Box sx={{ px: collapsed ? 1 : 2, py: 2 }}>
        {!collapsed ? (
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ px: 1.5, fontWeight: 750, letterSpacing: '0.12em' }}
          >
            Workspace
          </Typography>
        ) : null}
        <List sx={{ mt: collapsed ? 0 : 0.5 }}>
          {primaryNavigation.map((item) => (
            <NavigationListItem
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              key={item.path}
            />
          ))}
        </List>
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <Divider />
        <List sx={{ p: collapsed ? 1 : 2 }}>
          {secondaryNavigation.map((item) => (
            <NavigationListItem
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              key={item.path}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
}

export function NavigationDrawer({
  mobileOpen,
  desktopCollapsed,
  onMobileClose,
}: NavigationDrawerProps) {
  const desktopWidth = desktopCollapsed
    ? collapsedDrawerWidth
    : expandedDrawerWidth;

  return (
    <Box component="nav" aria-label="Primary navigation">
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: expandedDrawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <DrawerContent collapsed={false} onNavigate={onMobileClose} />
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          width: desktopWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: desktopWidth,
            boxSizing: 'border-box',
            borderRightColor: 'divider',
            transition: (theme) =>
              theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.shorter,
              }),
          },
        }}
      >
        <DrawerContent collapsed={desktopCollapsed} />
      </Drawer>
    </Box>
  );
}
