import BackspaceOutlined from '@mui/icons-material/BackspaceOutlined';
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import HealingOutlined from '@mui/icons-material/HealingOutlined';
import TimelapseOutlined from '@mui/icons-material/TimelapseOutlined';
import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import type { Employee } from '../../types/firestore';
import {
  CALENDAR_CONSTRUCTOR_TOOLS,
  type CalendarConstructorBlockedReason,
  type CalendarConstructorTool,
  type CalendarRangeSelection,
} from './calendarConstructor';

interface CalendarConstructorToolbarProps {
  selectedTool: CalendarConstructorTool;
  onSelectedToolChange: (tool: CalendarConstructorTool) => void;
  selection: CalendarRangeSelection | null;
  selectedEmployee: Employee | null;
  hoursInput: string;
  onHoursInputChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  blockedReason: CalendarConstructorBlockedReason;
  isApplying: boolean;
  onApply: () => void;
  onClearSelection: () => void;
  isSettled: boolean;
}

const toolIcons: Record<CalendarConstructorTool, ReactNode> = {
  review: <FactCheckOutlined />,
  hours: <TimelapseOutlined />,
  L4: <HealingOutlined />,
  UW: <EditCalendarOutlined />,
  UZ: <EditCalendarOutlined />,
  NN: <EventBusyOutlined />,
  'clear-manual': <BackspaceOutlined />,
};

export function CalendarConstructorToolbar({
  selectedTool,
  onSelectedToolChange,
  selection,
  selectedEmployee,
  hoursInput,
  onHoursInputChange,
  note,
  onNoteChange,
  blockedReason,
  isApplying,
  onApply,
  onClearSelection,
  isSettled,
}: CalendarConstructorToolbarProps) {
  const t = useTranslations();
  const operationRequiresApply = selectedTool !== 'review';
  const canApply =
    operationRequiresApply &&
    Boolean(selection) &&
    !blockedReason &&
    !isApplying;

  return (
    <Card>
      <CardContent sx={{ p: '14px !important' }}>
        <Stack spacing={1}>
          <div>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {t.settlement.constructor.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.settlement.constructor.description}
            </Typography>
          </div>

          {isSettled ? (
            <Alert severity="info">
              {t.settlement.constructor.settledReadOnly}
            </Alert>
          ) : null}

          <ToggleButtonGroup
            exclusive
            size="small"
            value={selectedTool}
            onChange={(_, value: CalendarConstructorTool | null) => {
              if (value) {
                onSelectedToolChange(value);
              }
            }}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {CALENDAR_CONSTRUCTOR_TOOLS.map((tool) => (
              <ToggleButton
                key={tool}
                value={tool}
                disabled={isSettled && tool !== 'review'}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.65,
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: 'center' }}
                >
                  {toolIcons[tool]}
                  <span>{t.settlement.constructor.tools[tool]}</span>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'stretch', md: 'flex-start' } }}
          >
            {selectedTool === 'hours' ? (
              <TextField
                label={t.settlement.constructor.hours}
                value={hoursInput}
                onChange={(event) => onHoursInputChange(event.target.value)}
                size="small"
                sx={{ width: { xs: '100%', md: 180 } }}
                slotProps={{
                  htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
                }}
              />
            ) : null}
            {selectedTool !== 'review' ? (
              <TextField
                label={t.settlement.constructor.note}
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                size="small"
                sx={{ minWidth: { xs: '100%', md: 280 }, flexGrow: 1 }}
              />
            ) : null}
            <Button
              variant="contained"
              disabled={!canApply}
              onClick={onApply}
              startIcon={
                isApplying ? (
                  <CircularProgress size={16} color="inherit" />
                ) : null
              }
            >
              {t.settlement.constructor.apply}
            </Button>
            <Button
              disabled={!selection || isApplying}
              onClick={onClearSelection}
            >
              {t.settlement.constructor.clearSelection}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {selection && selectedEmployee
              ? interpolate(t.settlement.constructor.selection, {
                  employee: `${selectedEmployee.lastName} ${selectedEmployee.firstName}`,
                  start: selection.startDate,
                  end: selection.endDate,
                })
              : t.settlement.constructor.noSelection}
          </Typography>

          {blockedReason ? (
            <Alert severity="warning">
              {t.settlement.constructor.blocked[blockedReason]}
            </Alert>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
