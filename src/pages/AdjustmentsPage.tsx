import TuneOutlined from '@mui/icons-material/TuneOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.adjustments)!;

export function AdjustmentsPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={TuneOutlined}
    />
  );
}
