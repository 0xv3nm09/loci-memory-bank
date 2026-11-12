// Spaced repetition: intervals in days, weakest (lowest box) first.
export const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
const DAY = 86_400_000;
export interface Reviewable { box: number; dueAt: number }
export function review<T extends Reviewable>(n: T, correct: boolean, now = Date.now()): T {
  const box = correct ? Math.min(n.box + 1, INTERVALS_DAYS.length - 1) : 0;
  return { ...n, box, dueAt: now + (correct ? INTERVALS_DAYS[box]! * DAY : 10 * 60_000) };
}
export const isDue = (n: Reviewable, now = Date.now()) => n.dueAt <= now;
export function queue<T extends Reviewable>(notes: T[], now = Date.now()): T[] {
  return notes.filter((n) => isDue(n, now)).sort((a, b) => a.box - b.box || a.dueAt - b.dueAt);
}
