// Module boundaries per course — the lesson number after which each module's contest falls.
// Module number = index + 1 (1-based).
const MODULE_BOUNDARIES: Record<string, number[]> = {
  // Complete DJ Course
  "complete dj course (group)": [9, 14, 21, 28, 33],
  "complete dj course": [9, 14, 21, 28, 33],
  "complete dj course (online)": [9, 14, 21, 28, 33],

  // Professional EDM DJ Course
  "professional edm dj course": [9, 13, 18, 23],
  "professional edm dj course (online)": [9, 13, 18, 23],

  // Professional HipHop DJ Course
  "professional hiphop music dj course": [9, 12, 17, 24, 29],
  "professional urban music dj course (online)": [9, 12, 17, 24, 29],

  // Beginner DJ Course
  "level 1 - beginner dj course (group)": [8],
  "level 1 - beginner dj course": [8],
  "level 1 - beginner dj course (online)": [8],

  // Intermediate DJ Course
  "level 2 - intermediate dj course (group)": [5, 9, 14],
  "level 2 - intermediate dj course": [5, 9, 14],
  "level 2 - intermediate dj course (online)": [5, 9, 14],

  // Advance DJ Course
  "level 3 - advance dj course": [21, 26],
  "level 3 - advance dj course (group)": [21, 26],
  "level 3 - advance dj course (online)": [21, 26],

  // Kid DJ Course
  "kid dj course": [11],
  "kid dj course (group)": [11],
  "kid dj course (online)": [11],
};

/**
 * Returns the lesson numbers after which each module ends (and its contest falls).
 * Module 1 contest is after boundaries[0], Module 2 after boundaries[1], etc.
 * Returns [] for courses with no defined module structure.
 */
export function getModuleBoundaries(courseName: string): number[] {
  return MODULE_BOUNDARIES[courseName.toLowerCase().trim()] ?? [];
}
