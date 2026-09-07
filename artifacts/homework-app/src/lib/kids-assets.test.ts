import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { kidsAssetKeys } from "./kids-assets";

describe("kids asset registry", () => {
  it("resolves every approved key to an optimized local asset", () => {
    const publicDirectory = resolve(process.cwd(), "public");
    for (const assetKey of kidsAssetKeys) {
      const extension = assetKey.startsWith("kids/audio/") ? ".mp3" : ".svg";
      const file = resolve(publicDirectory, `${assetKey}${extension}`);
      expect(existsSync(file), assetKey).toBe(true);
      expect(statSync(file).size, assetKey).toBeGreaterThan(100);
    }
  });
});