import path from "node:path";
import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { validateConfigPaths } from "@/lib/config/config";
import { assertPathInside, isPathInside } from "@/lib/security/safe-path";
import type { AppConfig } from "@/lib/types";

describe("safe path", () => {
  const root = path.resolve("fixtures", "safe-root");

  it("accepts the root and descendants", () => {
    expect(isPathInside(root, root)).toBe(true);
    expect(isPathInside(root, path.join(root, "Sandbox", "Save01"))).toBe(true);
  });

  it("rejects traversal and sibling paths", () => {
    const sibling = path.resolve(root, "..", "unsafe-root", "save");
    expect(isPathInside(root, sibling)).toBe(false);
    expect(() => assertPathInside(root, sibling)).toThrow(AppError);
  });

  it("rejects overlapping save and backup directories", () => {
    const config: AppConfig = {
      zomboidSavesPath: root,
      backupPath: path.join(root, "backups"),
      maxAutomaticBackups: 10,
      backupBeforeLaunch: true,
      deleteOldBackups: true,
      enableCharacterRecovery: false,
    };

    expect(() => validateConfigPaths(config)).toThrowError(
      "As pastas de saves e backups devem ficar em locais separados.",
    );
  });
});
