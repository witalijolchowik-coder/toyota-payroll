import { useState } from 'react';
import { Stack } from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { MonthSelector } from '../features/settlement/MonthSelector';
import { SettlementMonthView } from '../features/settlement/SettlementMonthView';
import { currentMonthId } from '../features/settlement/monthUtils';
import { useTranslations } from '../hooks/useTranslations';
import type { MonthId } from '../types/firestore';

export function MonthlySettlementPage() {
  const t = useTranslations();
  const [monthId, setMonthId] = useState<MonthId>(() => currentMonthId());

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={t.settlement.page.eyebrow}
        title={t.settlement.page.title}
        description={t.settlement.page.description}
        action={<MonthSelector monthId={monthId} onChange={setMonthId} />}
      />
      <SettlementMonthView key={monthId} monthId={monthId} />
    </Stack>
  );
}
