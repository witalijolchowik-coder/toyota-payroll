import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  Department,
  Employee,
  EmployeeAssignment,
  EmployeeColorShift,
} from '../../types/firestore';
import { EMPLOYEE_COLOR_SHIFTS } from '../../utils/organization';
import { resolveEffectiveAssignment } from '../../utils/schedule';
import { intervalHours } from '../../utils/payroll/workTimeDeviations';
import type { BrigadeScheduleDay } from '../../utils/schedule/brigadeSchedule';
import { saveBrigadeScheduleDays } from '../../services/brigadeScheduleService';

export function BrigadeCalendarPanel({
  monthId,
  departments,
  employees,
  assignments,
  plans,
  locked,
  onReload,
}: {
  monthId: string;
  departments: readonly Department[];
  employees: readonly Employee[];
  assignments: readonly EmployeeAssignment[];
  plans: readonly BrigadeScheduleDay[];
  locked: boolean;
  onReload: () => Promise<void>;
}) {
  const available = departments.filter(
    (d) =>
      d.active &&
      d.brigadeSchedulingFrom &&
      d.brigadeSchedulingFrom.slice(0, 7) <= monthId,
  );
  const [departmentId, setDepartmentId] = useState(available[0]?.id ?? '');
  const [brigade, setBrigade] = useState<EmployeeColorShift>('WHITE');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState(monthId + '-01'),
    [to, setTo] = useState(monthId + '-01');
  const [kind, setKind] = useState<BrigadeScheduleDay['kind']>('DAY');
  const [start, setStart] = useState('06:00'),
    [end, setEnd] = useState('18:00');
  const [note, setNote] = useState(''),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  if (!available.length) return null;
  const members = employees.filter((e) => {
    const a = resolveEffectiveAssignment(e, from, assignments);
    return a.departmentId === departmentId && a.shiftAssignment === brigade;
  });
  const selected = plans.find(
    (p) =>
      p.departmentId === departmentId &&
      p.brigade === brigade &&
      (p.employeeId ?? '') === employeeId &&
      p.date === from &&
      p.status === 'ACTIVE',
  );
  const hours =
    kind === 'DAY_OFF'
      ? 0
      : start && end
        ? intervalHours({ startTime: start, endTime: end })
        : 0;
  const save = async (cancel = false) => {
    setError(null);
    if (
      from > to ||
      from.slice(0, 7) !== monthId ||
      to.slice(0, 7) !== monthId
    ) {
      setError('Zakres musi należeć do wybranego miesiąca');
      return;
    }
    setBusy(true);
    try {
      const values: BrigadeScheduleDay[] = [];
      let date = from;
      while (date <= to) {
        values.push({
          id: '',
          departmentId,
          brigade,
          employeeId: employeeId || null,
          date,
          kind,
          startTime: kind === 'DAY_OFF' ? null : start,
          endTime: kind === 'DAY_OFF' ? null : end,
          plannedHours: hours,
          status: cancel ? 'CANCELLED' : 'ACTIVE',
          note: note.trim() || null,
        });
        const next = new Date(date + 'T00:00:00Z');
        next.setUTCDate(next.getUTCDate() + 1);
        date = next.toISOString().slice(0, 10);
      }
      await saveBrigadeScheduleDays(values);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6">Plan brygad — dni i godziny</Typography>
            <Button onClick={() => setOpen(!open)}>
              {open ? 'Zwiń' : 'Konfiguruj plan'}
            </Button>
          </Stack>
          <Typography variant="body2">
            Nominał brygadowy wynika wyłącznie z zapisanego planu. Brak wpisu
            oznacza brak planu, nie dzień wolny. Zapis planu nie przelicza
            rozliczenia.
          </Typography>
          {open ? (
            <>
              <Alert severity="info">
                Plan indywidualny zastępuje plan brygady. Istniejące ręczne
                korekty dnia w edytorze mają pierwszeństwo. Obecność i absencje
                pozostają osobnymi dokumentami.
              </Alert>
              {locked ? (
                <Alert severity="warning">
                  Miesiąc zablokowany — plan tylko do odczytu.
                </Alert>
              ) : null}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  select
                  label="Dział brygadowy"
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setEmployeeId('');
                  }}
                  fullWidth
                >
                  {available.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Brygada"
                  value={brigade}
                  onChange={(e) => {
                    setBrigade(e.target.value as EmployeeColorShift);
                    setEmployeeId('');
                  }}
                  fullWidth
                >
                  {EMPLOYEE_COLOR_SHIFTS.map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Zakres pracowników"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  fullWidth
                >
                  <MenuItem value="">Cała brygada</MenuItem>
                  {members.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.lastName} {e.firstName}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField
                  type="date"
                  label="Data od"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setTo(e.target.value);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  type="date"
                  label="Data do"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  select
                  label="Plan dnia"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as BrigadeScheduleDay['kind'])
                  }
                >
                  <MenuItem value="DAY">D — dzień pracy</MenuItem>
                  <MenuItem value="NIGHT">N — zmiana nocna</MenuItem>
                  <MenuItem value="DAY_OFF">W — dzień wolny</MenuItem>
                </TextField>
                {kind !== 'DAY_OFF' ? (
                  <>
                    <TextField
                      type="time"
                      label="Planowany start"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      type="time"
                      label="Planowany koniec"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </>
                ) : null}
                <TextField
                  label="Planowane godziny"
                  value={hours}
                  slotProps={{ input: { readOnly: true } }}
                />
              </Stack>
              <TextField
                label="Notatka do planu"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Typography variant="body2">
                Zapis na {from}:{' '}
                {selected
                  ? `${selected.kind}, ${selected.plannedHours} h${selected.startTime ? ' ' + selected.startTime + '–' + selected.endTime : ''}`
                  : 'Brak aktywnego wpisu'}
                . Pracownicy brygady na tę datę: {members.length}.
              </Typography>
              {selected ? (
                <Button
                  onClick={() => {
                    setKind(selected.kind);
                    setStart(selected.startTime ?? '06:00');
                    setEnd(selected.endTime ?? '18:00');
                    setNote(selected.note ?? '');
                  }}
                >
                  Wczytaj zapis do edycji
                </Button>
              ) : null}
              {error ? <Alert severity="error">{error}</Alert> : null}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={locked || busy || !departmentId}
                  onClick={() => void save()}
                >
                  Zapisz plan
                </Button>
                {employeeId ? (
                  <Button
                    disabled={locked || busy}
                    onClick={() => void save(true)}
                  >
                    Przywróć plan brygady
                  </Button>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
