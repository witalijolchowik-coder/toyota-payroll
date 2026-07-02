import SettingsOutlined from '@mui/icons-material/SettingsOutlined';

import { ModulePlaceholder } from '../components/placeholders/ModulePlaceholder';
import { getNavigationItem } from '../config/navigation';
import { routes } from '../utils/routes';

const page = getNavigationItem(routes.settings)!;

export function SettingsPage() {
  return (
    <ModulePlaceholder
      title={page.label}
      description={page.description}
      icon={SettingsOutlined}
    />
  );
}
