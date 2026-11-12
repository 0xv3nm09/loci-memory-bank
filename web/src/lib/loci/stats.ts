// Return-visit stats: day streak and weekly remembered count (the north-star measure).
const DAY = 86_400_000;
export interface Stats { days: string[]; remembered: number[]; lastVisit: number | null }
export const emptyStats = (): Stats => ({ days: [], remembered: [], lastVisit: null });
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export function recordVisit(s: Stats, now = Date.now()): Stats {
  const k = dayKey(now);
  return { ...s, days: s.days.includes(k) ? s.days : [...s.days, k].slice(-400), lastVisit: now };
}
export function streak(s: Stats, now = Date.now()): number {
  const set = new Set(s.days);
  let n = 0, t = now;
  if (!set.has(dayKey(t))) t -= DAY; // a streak survives until today ends
  while (set.has(dayKey(t))) { n++; t -= DAY; }
  return n;
}
export const recordRemembered = (s: Stats, now = Date.now()): Stats => ({ ...s, remembered: [...s.remembered.filter((t) => now - t < 30 * DAY), now] });
export const rememberedThisWeek = (s: Stats, now = Date.now()) => s.remembered.filter((t) => now - t < 7 * DAY).length;
/** Show a welcome-back greeting when the last visit was over an hour ago. */
export const isReturning = (s: Stats, now = Date.now()) => s.lastVisit !== null && now - s.lastVisit > 3_600_000;
