import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth } from '../config/firebase';
import { getFirestoreRepositories } from './firestoreService';
import {
  CALENDAR_APPEARANCE_KEYS,
  DEFAULT_CALENDAR_APPEARANCE,
  mergeCalendarAppearance,
  type CalendarAppearancePalette,
} from '../utils/calendarAppearance';

export async function loadCalendarAppearance(): Promise<CalendarAppearancePalette> {
  const repositories = getFirestoreRepositories();
  if (!repositories || !auth?.currentUser) return DEFAULT_CALENDAR_APPEARANCE;
  const snapshot = await getDoc(repositories.calendarAppearance);
  if (!snapshot.exists()) return DEFAULT_CALENDAR_APPEARANCE;
  const data = snapshot.data();
  const textColors = data.text_colors;
  const backgroundColors = data.background_colors;
  return mergeCalendarAppearance(
    Object.fromEntries(
      CALENDAR_APPEARANCE_KEYS.map((key) => [
        key,
        {
          text: textColors[key],
          background: backgroundColors[key],
        },
      ]),
    ) as Partial<CalendarAppearancePalette>,
  );
}

export async function saveCalendarAppearance(
  palette: CalendarAppearancePalette,
): Promise<void> {
  const repositories = getFirestoreRepositories();
  if (!repositories || !auth?.currentUser) {
    throw new Error('firebase-unavailable');
  }
  const reference = repositories.calendarAppearance;
  const existing = await getDoc(reference);
  const uid = auth.currentUser.uid;
  const colors = mergeCalendarAppearance(palette);
  await setDoc(reference, {
    version: 1,
    text_colors: Object.fromEntries(
      CALENDAR_APPEARANCE_KEYS.map((key) => [key, colors[key].text]),
    ),
    background_colors: Object.fromEntries(
      CALENDAR_APPEARANCE_KEYS.map((key) => [key, colors[key].background]),
    ),
    ...(existing.exists()
      ? {
          created_at: existing.data().created_at,
          created_by: existing.data().created_by,
        }
      : { created_at: serverTimestamp(), created_by: uid }),
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
}
