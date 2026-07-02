import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.settlement)!;

export function MonthlySettlementPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={AssessmentOutlined}
    />
  );
}
