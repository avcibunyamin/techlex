export function getLocalDateString(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function dateToDayNumber(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getDayDifference(fromDate: string, toDate: string): number {
  return dateToDayNumber(toDate) - dateToDayNumber(fromDate);
}

export function streakAfterStudy(
  currentStreak: number,
  lastStudyDate: string | null,
  studyDate: string,
): number {
  if (!lastStudyDate) return 1;

  const difference = getDayDifference(lastStudyDate, studyDate);
  if (difference <= 0) return currentStreak;
  if (difference === 1) return currentStreak + 1;
  return 1;
}

export function streakAfterLoad(
  currentStreak: number,
  lastStudyDate: string | null,
  today: string,
): number {
  if (!lastStudyDate) return currentStreak;
  return getDayDifference(lastStudyDate, today) > 1 ? 0 : currentStreak;
}
