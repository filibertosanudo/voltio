import { describe, expect, it } from "vitest";
import { currentSection, readingLine } from "./current-section";

const VIEWPORT = 900;
const FAR = 5_000;

describe("currentSection", () => {
  it("marks nothing while the reader is still in the hero", () => {
    expect(currentSection([700, 1500, 2300, 3200], VIEWPORT, FAR)).toBe(-1);
  });

  it("marks the last section whose top crossed the reading line", () => {
    expect(currentSection([200, 1000, 1800, 2700], VIEWPORT, FAR)).toBe(0);
    expect(currentSection([-900, -100, 700, 1600], VIEWPORT, FAR)).toBe(1);
  });

  it("hands over to a short last section before the very last pixel", () => {
    // Contact starts at 650: it never reaches the usual line at 300.
    const tops = [-2600, -1800, -700, 650];
    expect(currentSection(tops, VIEWPORT, FAR)).toBe(2);
    expect(currentSection(tops, VIEWPORT, 100)).toBe(3);
    expect(currentSection(tops, VIEWPORT, 0)).toBe(3);
  });

  it("never marks a section that is still below the screen", () => {
    expect(currentSection([-200, 600, 950], VIEWPORT, 0)).toBe(1);
  });
});

describe("readingLine", () => {
  it("sits a third of the way down until the last half-screen of scrolling", () => {
    expect(readingLine(VIEWPORT, FAR)).toBe(300);
    expect(readingLine(VIEWPORT, 452)).toBe(300);
  });

  it("slides to the bottom edge as the page runs out", () => {
    expect(readingLine(VIEWPORT, 227)).toBeCloseTo(599.5);
    expect(readingLine(VIEWPORT, 0)).toBe(899);
    // Rounding: 1.4 px short of the end is the end.
    expect(readingLine(VIEWPORT, 1.4)).toBe(899);
  });
});
