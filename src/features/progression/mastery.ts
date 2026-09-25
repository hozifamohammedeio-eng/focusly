import { calculateLevelProgress } from "./levels";

import type {
  SubjectMasteryRow,
  SubjectProgressSnapshot,
} from "./types";

/** Convert trusted subject activity into the shared derived level curve. */
export function createSubjectProgressSnapshot(
  row: SubjectMasteryRow,
): SubjectProgressSnapshot {
  return {
    ...row,
    mastery: calculateLevelProgress(row.totalXp),
  };
}

export function createSubjectProgressSnapshots(
  rows: readonly SubjectMasteryRow[],
): SubjectProgressSnapshot[] {
  return rows.map(createSubjectProgressSnapshot);
}
