import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';

import { pl } from '../i18n/pl';
import type { NavigationItem } from '../types/navigation';
import { routes } from '../utils/routes';

export const primaryNavigation: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: routes.dashboard,
    icon: DashboardOutlined,
    description: 'A concise overview of the current payroll workspace.',
  },
  {
    label: pl.navigation.employees.label,
    path: routes.employees,
    icon: GroupsOutlined,
    description: pl.navigation.employees.description,
  },
  {
    label: pl.navigation.settlement.label,
    path: routes.settlement,
    icon: AssessmentOutlined,
    description: pl.navigation.settlement.description,
  },
  {
    label: pl.navigation.absences.label,
    path: routes.absences,
    icon: EventBusyOutlined,
    description: pl.navigation.absences.description,
  },
  {
    label: 'Adjustments',
    path: routes.adjustments,
    icon: TuneOutlined,
    description: 'System-calculated and coordinator-entered adjustments.',
  },
  {
    label: 'Reports',
    path: routes.reports,
    icon: SummarizeOutlined,
    description: 'Generate settlement, absence, and SOZ outputs.',
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    label: 'Settings',
    path: routes.settings,
    icon: SettingsOutlined,
    description: 'Application preferences and administrative configuration.',
  },
];

export const allNavigationItems = [
  ...primaryNavigation,
  ...secondaryNavigation,
];

export function getNavigationItem(pathname: string) {
  return allNavigationItems.find((item) => item.path === pathname);
}
