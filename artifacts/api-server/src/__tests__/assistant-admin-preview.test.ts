import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: { execute: vi.fn() } }));
import { authorizeAssistantExecution, getAssistantExecutionAccess } from "../lib/assistant-execution-access";

function executor(admin: boolean) {
  return {
    execute: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ consumed_operation_id: "used-trial", reserved_operation_id: null }] })
      .mockResolvedValueOnce({ rows: [{ is_admin: admin }] }),
  };
}
afterEach(() => vi.unstubAllEnvs());

describe("assistant development-only admin testing", () => {
  it("allows an admin with a used trial without overwriting or reserving the trial", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REPLIT_DEPLOYMENT", "");
    vi.stubEnv("ASSISTANT_PREVIEW_ADMIN_ACCESS", "true");
    const tx = executor(true);
    expect(await authorizeAssistantExecution(tx, 1, "new-operation")).toBe("admin_preview");
    expect(tx.execute).toHaveBeenCalledTimes(3);
  });
  it("keeps non-admins subject to the ordinary subscription rules", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ASSISTANT_PREVIEW_ADMIN_ACCESS", "true");
    expect(await getAssistantExecutionAccess(1, executor(false))).toMatchObject({
      status: "upgrade_required", canExecute: false, consumedOperationId: "used-trial",
    });
  });
  it.each([
    ["production", "", "true"],
    ["development", "1", "true"],
    ["development", "", "false"],
  ])("does not bypass eligibility in %s with deployment=%s and flag=%s", async (env, deployed, enabled) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("REPLIT_DEPLOYMENT", deployed);
    vi.stubEnv("ASSISTANT_PREVIEW_ADMIN_ACCESS", enabled);
    const tx = executor(true);
    expect(await getAssistantExecutionAccess(1, tx)).toMatchObject({ status: "upgrade_required", canExecute: false });
    expect(tx.execute).toHaveBeenCalledTimes(2);
  });
});
