import { describe, expect, it } from "vitest";
import { countAt, smoothstep } from "./count-up";

describe("count-up easing", () => {
  it("starts at 0, ends exactly at the target, and never overshoots", () => {
    expect(countAt(100, 0)).toBe(0);
    expect(countAt(100, 2000)).toBe(100);
    expect(countAt(100, 9000)).toBe(100);
    expect(countAt(90, -50)).toBe(0);
  });

  it("climbs without a leap in the first frames", () => {
    // One frame in (~16 ms): still at the very start.
    expect(countAt(100, 16)).toBe(0);
    // The previous curve was already at 39 by 150 ms.
    expect(countAt(100, 150)).toBeLessThan(5);
    expect(countAt(100, 1000)).toBe(50);
  });

  it("only ever goes up", () => {
    let previous = 0;
    for (let ms = 0; ms <= 2000; ms += 16) {
      const value = countAt(24, ms);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(smoothstep(0.5)).toBe(0.5);
  });
});
