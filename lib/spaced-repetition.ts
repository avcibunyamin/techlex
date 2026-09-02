import { UserProgress } from '@/types';

const BOX_INTERVALS: Record<number, number> = {
  1: 0,                            // Immediate
  2: 1 * 24 * 60 * 60 * 1000,     // 1 day
  3: 3 * 24 * 60 * 60 * 1000,     // 3 days
  4: 7 * 24 * 60 * 60 * 1000,     // 1 week
  5: 14 * 24 * 60 * 60 * 1000,    // 2 weeks
};

export function createProgress(termId: string): UserProgress {
  const now = Date.now();
  return {
    termId,
    box: 1,
    lastSeen: now,
    nextReview: now,
    timesCorrect: 0,
    timesSeen: 0,
  };
}

export function markKnown(progress: UserProgress): UserProgress {
  const now = Date.now();
  const newBox = Math.min(progress.box + 1, 5) as 1 | 2 | 3 | 4 | 5;
  return {
    ...progress,
    box: newBox,
    lastSeen: now,
    nextReview: now + BOX_INTERVALS[newBox],
    timesCorrect: progress.timesCorrect + 1,
    timesSeen: progress.timesSeen + 1,
  };
}

export function markUnknown(progress: UserProgress): UserProgress {
  const now = Date.now();
  return {
    ...progress,
    box: 1,
    lastSeen: now,
    nextReview: now + BOX_INTERVALS[1],
    timesSeen: progress.timesSeen + 1,
  };
}

export function isDueForReview(progress: UserProgress): boolean {
  return Date.now() >= progress.nextReview;
}

export function sortByPriority(progressList: UserProgress[]): UserProgress[] {
  return [...progressList].sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box;
    return a.nextReview - b.nextReview;
  });
}

export function getStats(progressList: UserProgress[]) {
  const total = progressList.length;
  const mastered = progressList.filter(p => p.box >= 4).length;
  const learning = progressList.filter(p => p.box >= 2 && p.box < 4).length;
  const newTerms = progressList.filter(p => p.box === 1 && p.timesSeen === 0).length;
  const dueForReview = progressList.filter(isDueForReview).length;

  return { total, mastered, learning, newTerms, dueForReview };
}
