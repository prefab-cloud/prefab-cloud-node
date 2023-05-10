import type { ProjectEnvId } from "./types";

export interface SortableRow {
  projectEnvId?: ProjectEnvId;
}

// sort so that the rows matching our projectEnvId are first
export const sortRows = <T extends SortableRow>(
  rows: T[],
  projectEnvId: ProjectEnvId
): T[] => {
  return rows.sort((a, b) => {
    const aMatches = a.projectEnvId?.equals(projectEnvId) ?? false;
    const bMatches = b.projectEnvId?.equals(projectEnvId) ?? false;

    if (aMatches && !bMatches) {
      return -1;
    } else if (!aMatches && bMatches) {
      return 1;
    } else {
      return 0;
    }
  });
};
