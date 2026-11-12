import { describe, expect, it } from "vitest";
import { emptyStats, isReturning, recordRemembered, recordVisit, rememberedThisWeek, streak } from "./stats";
const D = 86_400_000, T = Date.UTC(2026, 10, 12, 12);
describe("stats", () => {
  it("counts consecutive days", () => {
    let s = emptyStats();
    [T - 2 * D, T - D, T].forEach((t) => (s = recordVisit(s, t)));
    expect(streak(s, T)).toBe(3);
  });
  it("streak survives until today ends", () => expect(streak(recordVisit(emptyStats(), T - D), T)).toBe(1));
  it("gap breaks streak", () => expect(streak(recordVisit(emptyStats(), T - 3 * D), T)).toBe(0));
  it("weekly remembered only counts last 7 days", () => {
    let s = recordRemembered(emptyStats(), T - 8 * D); s = recordRemembered(s, T - D); s = recordRemembered(s, T);
    expect(rememberedThisWeek(s, T)).toBe(2);
  });
  it("welcome back after more than an hour", () => {
    expect(isReturning({ ...emptyStats(), lastVisit: T - 2 * 3_600_000 }, T)).toBe(true);
    expect(isReturning({ ...emptyStats(), lastVisit: T - 60_000 }, T)).toBe(false);
  });
});
