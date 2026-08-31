export const ALL_CLASSES_VALUE = "__all_classes__";
export const EXCLUDED_CLASS_PREFIX = "__excluded_class__:";

export function getWheelVisualSliceIndex(
  participantIndex: number,
  participantCount: number,
  visualSliceCount: number,
) {
  if (participantCount <= 0 || visualSliceCount <= 0) return 0;
  return Math.min(
    visualSliceCount - 1,
    Math.floor((participantIndex * visualSliceCount) / participantCount),
  );
}

export function isStudentInSelectedClasses(
  studentClass: string | null | undefined,
  gradeLevel: string | null | undefined,
  selectedClassNames: string[],
) {
  if (selectedClassNames.length === 0) return false;

  const allClassesSelected = selectedClassNames.includes(ALL_CLASSES_VALUE);
  const excluded = new Set(
    selectedClassNames
      .filter((name) => name.startsWith(EXCLUDED_CLASS_PREFIX))
      .map((name) => name.slice(EXCLUDED_CLASS_PREFIX.length)),
  );

  if (allClassesSelected) {
    return !excluded.has(studentClass || "") && !excluded.has(gradeLevel || "");
  }

  const selected = new Set(selectedClassNames);
  return selected.has(studentClass || "") || selected.has(gradeLevel || "");
}