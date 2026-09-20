import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("../lib/library-orphan-sweep", () => ({
  isLibraryOwnedUpload: (path: string) =>
    path.startsWith("/objects/uploads/teacher-library/"),
}));

import {
  migrateLegacyLibraryRecord,
  type LegacyLibraryMigrationDeps,
  type LegacyLibraryMigrationRecord,
} from "../lib/library-legacy-migration";

const record: LegacyLibraryMigrationRecord = {
  fileId: 7,
  teacherId: 42,
  sourcePath: "/objects/uploads/old-object",
  targetPath: null,
  sourceGeneration: null,
  state: "pending",
};

function deps(): LegacyLibraryMigrationDeps {
  return {
    copy: vi.fn().mockResolvedValue({
      objectPath: "/objects/uploads/teacher-library/42/legacy-7",
      sourceGeneration: "123",
    }),
    ensureCopy: vi.fn(),
    saveCopy: vi.fn(),
    commit: vi.fn().mockResolvedValue("committed"),
    markCommitted: vi.fn(),
    deleteSource: vi.fn(),
    deleteTarget: vi.fn(),
    hasSourceReferences: vi.fn().mockResolvedValue(false),
    defer: vi.fn(),
    block: vi.fn(),
    markCleaned: vi.fn(),
  };
}

describe("legacy teacher library migration", () => {
  it("never deletes the source before the ownership row points at the copy", async () => {
    const d = deps();
    const order: string[] = [];
    vi.mocked(d.saveCopy).mockImplementation(async () => { order.push("copy-recorded"); });
    vi.mocked(d.ensureCopy).mockImplementation(async () => { order.push("copy-verified"); });
    vi.mocked(d.commit).mockImplementation(async () => { order.push("db-committed"); return "committed"; });
    vi.mocked(d.deleteSource).mockImplementation(async () => { order.push("source-deleted"); });

    await migrateLegacyLibraryRecord(record, d);

    expect(order).toEqual(["copy-recorded", "copy-verified", "db-committed", "source-deleted"]);
    expect(d.markCleaned).toHaveBeenCalledOnce();
  });

  it("stops safely when the atomic path update loses its ownership check", async () => {
    const d = deps();
    vi.mocked(d.commit).mockResolvedValue("conflict");

    await expect(migrateLegacyLibraryRecord(record, d)).resolves.toBe("skipped");

    expect(d.deleteSource).not.toHaveBeenCalled();
    expect(d.markCleaned).not.toHaveBeenCalled();
    expect(d.block).toHaveBeenCalledWith(
      record,
      "library row points to a different object",
    );
  });

  it("makes no ownership or deletion changes when the source cannot be copied", async () => {
    const d = deps();
    vi.mocked(d.copy).mockRejectedValue(new Error("source missing"));

    await expect(migrateLegacyLibraryRecord(record, d)).rejects.toThrow("source missing");

    expect(d.saveCopy).not.toHaveBeenCalled();
    expect(d.commit).not.toHaveBeenCalled();
    expect(d.deleteSource).not.toHaveBeenCalled();
    expect(d.deleteTarget).not.toHaveBeenCalled();
  });

  it("does not commit or delete the source when a recorded target cannot be restored", async () => {
    const d = deps();
    const copied: LegacyLibraryMigrationRecord = {
      ...record,
      targetPath: "/objects/uploads/teacher-library/42/legacy-7",
      sourceGeneration: "123",
      state: "copied",
    };
    vi.mocked(d.ensureCopy).mockRejectedValue(new Error("target recreation failed"));

    await expect(migrateLegacyLibraryRecord(copied, d)).rejects.toThrow("target recreation failed");

    expect(d.copy).not.toHaveBeenCalled();
    expect(d.commit).not.toHaveBeenCalled();
    expect(d.deleteSource).not.toHaveBeenCalled();
    expect(d.markCleaned).not.toHaveBeenCalled();
  });

  it("cleans only the two explicitly recorded objects if the library row was deleted", async () => {
    const d = deps();
    vi.mocked(d.commit).mockResolvedValue("missing");

    await migrateLegacyLibraryRecord(record, d);

    expect(d.deleteTarget).toHaveBeenCalledWith(
      record,
      "/objects/uploads/teacher-library/42/legacy-7",
    );
    expect(d.deleteSource).toHaveBeenCalledWith(record, "123");
    expect(d.markCleaned).toHaveBeenCalledOnce();
  });

  it("keeps a shared legacy source until every application reference is gone", async () => {
    const d = deps();
    vi.mocked(d.hasSourceReferences).mockResolvedValue(true);

    await expect(migrateLegacyLibraryRecord(record, d)).resolves.toBe("skipped");

    expect(d.markCommitted).toHaveBeenCalledOnce();
    expect(d.defer).toHaveBeenCalledOnce();
    expect(d.deleteSource).not.toHaveBeenCalled();
    expect(d.markCleaned).not.toHaveBeenCalled();
  });

  it("resumes from a recorded copy without copying or committing twice", async () => {
    const d = deps();
    const resumed: LegacyLibraryMigrationRecord = {
      ...record,
      targetPath: "/objects/uploads/teacher-library/42/legacy-7",
      sourceGeneration: "123",
      state: "committed",
    };

    await migrateLegacyLibraryRecord(resumed, d);

    expect(d.copy).not.toHaveBeenCalled();
    expect(d.ensureCopy).not.toHaveBeenCalled();
    expect(d.commit).not.toHaveBeenCalled();
    expect(d.deleteSource).toHaveBeenCalledWith(resumed, "123");
    expect(d.markCleaned).toHaveBeenCalledOnce();
  });

  it("does not mark cleanup complete when deleting the proven source fails", async () => {
    const d = deps();
    vi.mocked(d.deleteSource).mockRejectedValue(new Error("storage unavailable"));

    await expect(migrateLegacyLibraryRecord(record, d)).rejects.toThrow("storage unavailable");
    expect(d.markCleaned).not.toHaveBeenCalled();
  });
});