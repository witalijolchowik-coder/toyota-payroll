import { useState } from 'react';

export function useNavigationDrawer() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  return {
    mobileOpen,
    desktopCollapsed,
    openMobileDrawer: () => setMobileOpen(true),
    closeMobileDrawer: () => setMobileOpen(false),
    toggleDesktopDrawer: () => setDesktopCollapsed((current) => !current),
  };
}
