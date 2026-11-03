import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  type BrigadeScheduleDay,
  validateBrigadeScheduleDay,
} from '../utils/schedule/brigadeSchedule';
import { getFirestoreRepositories } from './firestoreService';

export async function loadBrigadeScheduleDays(
  monthId: string,
): Promise<BrigadeScheduleDay[]> {
  if (!db) throw new Error('firebase-unavailable');
  const snapshot = await getDocs(
    collection(db, `months/${monthId}/brigadeScheduleDays`),
  );
  return snapshot.docs.map((d) => {
    const v = d.data();
    const day: BrigadeScheduleDay = {
      id: d.id,
      departmentId: v.department_id,
      brigade: v.brigade,
      employeeId: v.employee_id ?? null,
      date: v.date,
      kind: v.kind,
      startTime: v.start_time,
      endTime: v.end_time,
      plannedHours: v.planned_hours,
      status: v.status,
      note: v.note ?? null,
    };
    if (!validateBrigadeScheduleDay(day))
      throw new Error('Niepoprawny plan brygady');
    return day;
  });
}

export async function saveBrigadeScheduleDays(
  days: readonly BrigadeScheduleDay[],
) {
  const firestore = db,
    uid = auth?.currentUser?.uid,
    repositories = getFirestoreRepositories();
  if (!firestore || !uid || !repositories)
    throw new Error('authentication-required');
  if (
    !days.length ||
    days.length > 31 ||
    days.some((d) => !validateBrigadeScheduleDay(d))
  )
    throw new Error('Niepoprawny zakres lub przedział planu');
  const refs = days.map((d) =>
    doc(
      firestore,
      `months/${d.date.slice(0, 7)}/brigadeScheduleDays/${d.departmentId}_${d.brigade}_${d.employeeId ?? 'brigade'}_${d.date}`,
    ),
  );
  await runTransaction(firestore, async (tx) => {
    const snapshots = await Promise.all(
      days.map(async (d, i) => ({
        department: await tx.get(doc(firestore, 'departments', d.departmentId)),
        month: await tx.get(doc(firestore, 'months', d.date.slice(0, 7))),
        previous: await tx.get(refs[i]!),
      })),
    );
    snapshots.forEach((s, i) => {
      const d = days[i]!;
      if (!s.month.exists() || s.month.data().is_settled)
        throw new Error('Miesiąc nie istnieje lub jest zablokowany');
      if (
        !s.department.data()?.brigade_scheduling_from ||
        s.department.data()!.brigade_scheduling_from > d.date
      )
        throw new Error('Włącz grafik brygadowy dla działu i daty');
    });
    days.forEach((d, i) => {
      const prev = snapshots[i]!.previous;
      if (d.status === 'CANCELLED' && !prev.exists()) return;
      const payload = {
        department_id: d.departmentId,
        brigade: d.brigade,
        employee_id: d.employeeId,
        date: d.date,
        kind: d.kind,
        start_time: d.startTime,
        end_time: d.endTime,
        planned_hours: d.plannedHours,
        status: d.status,
        note: d.note,
      };
      if (
        prev.exists() &&
        Object.entries(payload).every(
          ([key, value]) => prev.data()?.[key] === value,
        )
      )
        return;
      tx.set(refs[i]!, {
        ...payload,
        created_at: prev.data()?.created_at ?? serverTimestamp(),
        created_by: prev.data()?.created_by ?? uid,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
      // Same audit shape as repository batch writes; no monthly calculation is queued.
      tx.set(doc(repositories.auditLog), {
        entity_path: refs[i]!.path,
        action: prev.exists() ? 'update' : 'create',
        actor_uid: uid,
        occurred_at: serverTimestamp(),
        changes: {
          operation: 'brigade-schedule-day-saved',
          planned_hours: d.plannedHours,
          kind: d.kind,
          employee_id: d.employeeId,
          brigade: d.brigade,
          date: d.date,
        },
      });
    });
  });
}

export async function configureBrigadeScheduling(
  departmentId: string,
  from: string | null,
) {
  const firestore = db,
    uid = auth?.currentUser?.uid,
    repositories = getFirestoreRepositories();
  if (!firestore || !uid || !repositories)
    throw new Error('authentication-required');
  if (
    from &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      new Date(from + 'T00:00:00Z').toISOString().slice(0, 10) !== from)
  )
    throw new Error('Niepoprawna data');
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'departments', departmentId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Brak działu');
    tx.update(ref, {
      brigade_scheduling_from: from,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
    tx.set(doc(repositories.auditLog), {
      entity_path: ref.path,
      action: 'update',
      actor_uid: uid,
      occurred_at: serverTimestamp(),
      changes: {
        operation: 'brigade-scheduling-configured',
        effective_from: from,
        previous_effective_from: snap.data().brigade_scheduling_from ?? null,
      },
    });
  });
}
