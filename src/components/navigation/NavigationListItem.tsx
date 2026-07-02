import {
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import type { NavigationItem } from '../../types/navigation';

interface NavigationListItemProps {
  item: NavigationItem;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavigationListItem({
  item,
  collapsed,
  onNavigate,
}: NavigationListItemProps) {
  const location = useLocation();
  const selected = location.pathname === item.path;
  const Icon = item.icon;

  const button = (
    <ListItemButton
      component={RouterLink}
      to={item.path}
      selected={selected}
      onClick={onNavigate}
      aria-current={selected ? 'page' : undefined}
      sx={{
        minHeight: 48,
        justifyContent: collapsed ? 'center' : 'initial',
        px: collapsed ? 1.5 : 2,
        mb: 0.5,
        borderRadius: 2.5,
        '&.Mui-selected': {
          color: 'primary.main',
          bgcolor: 'color-mix(in srgb, currentColor 9%, transparent)',
        },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 42,
          justifyContent: 'center',
          color: selected ? 'primary.main' : 'text.secondary',
        }}
      >
        <Icon fontSize="small" />
      </ListItemIcon>
      {!collapsed ? (
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: 14,
                fontWeight: selected ? 700 : 600,
              },
            },
          }}
        />
      ) : null}
    </ListItemButton>
  );

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
