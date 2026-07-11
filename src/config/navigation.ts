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
    label: pl.navigation.dashboard.label,
    path: routes.dashboard,
    icon: DashboardOutlined,
    description: pl.navigation.dashboard.description,
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
    label: pl.navigation.adjustments.label,
    path: routes.adjustments,
    icon: TuneOutlined,
    description: pl.navigation.adjustments.description,
  },
  {
    label: pl.navigation.reports.label,
    path: routes.reports,
    icon: SummarizeOutlined,
    description: pl.navigation.reports.description,
  },
];

export const secondaryNavigation: NavigationItem[] = [
  {
    label: pl.navigation.settings.label,
    path: routes.settings,
    icon: SettingsOutlined,
    description: pl.navigation.settings.description,
  },
];

export const allNavigationItems = [
  ...primaryNavigation,
  ...secondaryNavigation,
];

export function getNavigationItem(pathname: string) {
  return allNavigationItems.find((item) => item.path === pathname);
}
