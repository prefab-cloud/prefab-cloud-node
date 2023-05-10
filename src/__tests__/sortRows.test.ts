import type { SortableRow } from "../sortRows";
import { sortRows } from "../sortRows";
import Long from "long";
import type { ConfigRow } from "../proto";

describe("sortRows", () => {
  const projectEnvId1 = Long.fromInt(1);
  const projectEnvId2 = Long.fromInt(2);

  it("should sort rows with matching projectEnvId first", () => {
    const rows: SortableRow[] = [
      { projectEnvId: projectEnvId2 },
      { projectEnvId: projectEnvId1 },
    ];

    const result = sortRows(rows, projectEnvId1);

    expect(result).toEqual([
      { projectEnvId: projectEnvId1 },
      { projectEnvId: projectEnvId2 },
    ]);
  });

  it("should keep the original order for non-matching rows", () => {
    const rows: SortableRow[] = [
      { projectEnvId: projectEnvId1 },
      { projectEnvId: projectEnvId2 },
    ];

    const result = sortRows(rows, Long.fromInt(3));

    expect(result).toEqual(rows);
  });

  it("should handle rows with missing projectEnvId", () => {
    const rows: SortableRow[] = [
      { projectEnvId: projectEnvId1 },
      {},
      { projectEnvId: projectEnvId2 },
    ];

    const result = sortRows(rows, projectEnvId1);

    expect(result).toEqual([
      { projectEnvId: projectEnvId1 },
      {},
      { projectEnvId: projectEnvId2 },
    ]);
  });

  it("should handle an empty array", () => {
    const rows: ConfigRow[] = [];

    const result = sortRows(rows, projectEnvId1);

    expect(result).toEqual([]);
  });
});
