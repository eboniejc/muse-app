// Module boundaries per course — the lesson number after which each module's contest falls.
// Module number = index + 1 (1-based).
const MODULE_BOUNDARIES: Record<string, number[]> = {
  "complete dj course": [9, 14, 21, 28, 33],
  "professional edm dj course": [9, 13, 18, 23],
  "professional hiphop dj course": [9, 12, 17, 24, 29],
  "beginner dj course": [8],
  "intermediate dj course": [5, 9, 14],
  "advance dj course": [21, 26],
  "kid dj course": [11],
};

/**
 * Returns the lesson numbers after which each module ends (and its contest falls).
 * Module 1 contest is after boundaries[0], Module 2 after boundaries[1], etc.
 * Returns [] for courses with no defined module structure.
 */
export function getModuleBoundaries(courseName: string): number[] {
  return MODULE_BOUNDARIES[courseName.toLowerCase().trim()] ?? [];
}
