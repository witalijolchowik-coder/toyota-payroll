import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.reports)!;

export function ReportsPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={SummarizeOutlined}
    />
  );
}
