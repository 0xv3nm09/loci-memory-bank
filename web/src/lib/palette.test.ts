import { describe, expect, it } from "vitest";
import { nebulaTint } from "./palette";

describe("starfield timing", () => {
  it("handles an animation timestamp just before initialization", () => {
    expect(nebulaTint(-0.001)).toEqual({ r: 0.6, g: 0.64, b: 0.83 });
  });
  it("keeps tint channels finite across long-running frames", () => {
    for (const time of [0, 40, 160, 10000, Number.NaN]) {
      expect(Object.values(nebulaTint(time)).every(Number.isFinite)).toBe(true);
    }
  });
});