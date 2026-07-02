import GroupsOutlined from '@mui/icons-material/GroupsOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.employees)!;

export function EmployeesPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={GroupsOutlined}
    />
  );
}
