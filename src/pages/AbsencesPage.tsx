import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.absences)!;

export function AbsencesPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={EventBusyOutlined}
    />
  );
}
