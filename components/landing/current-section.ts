/**
 * Which section the reader is on, from where each section's top sits.
 *
 * The current section is the last one whose top has crossed a reading line
 * a third of the way down the screen. That alone fails at the end of the
 * page: a short last section (contact, then the footer) can never scroll up
 * to the line, so the one before it would stay current forever. So over the
 * last half-screen of scrolling the line slides down to the bottom edge, and
 * the closing sections get their turn while they are actually being read.
 *
 * `remaining` is how far the page can still scroll down, in pixels.
 * Returns the index into `tops`, or -1 above the first section (the hero).
 */
export function currentSection(tops: readonly number[], viewportHeight: number, remaining: number): number {
  const line = readingLine(viewportHeight, remaining);
  let current = -1;
  tops.forEach((top, i) => {
    if (top <= line) current = i;
  });
  return current;
}

export function readingLine(viewportHeight: number, remaining: number): number {
  const base = viewportHeight / 3;
  const runway = viewportHeight / 2;
  // Browsers round scroll positions: within 2 px of the end is the end.
  const left = Math.max(remaining - 2, 0);
  if (left >= runway) return base;
  const progress = 1 - left / runway;
  // Just short of the bottom edge, so a section whose top is off screen never counts.
  return base + (viewportHeight - 1 - base) * progress;
}
