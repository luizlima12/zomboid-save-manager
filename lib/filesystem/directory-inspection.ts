import { createHash } from "node:crypto";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/lib/errors";
import { assertPathInside } from "@/lib/security/safe-path";

export interface DirectoryInspection {
  size: number;
  fileCount: number;
  directoryCount: number;
  fingerprint: string;
  lastModifiedMs: number;
}

export async function inspectDirectory(
  root: string,
): Promise<DirectoryInspection> {
  const rootStats = await lstat(root);
  const totals = {
    size: 0,
    fileCount: 0,
    directoryCount: 1,
    lastModifiedMs: rootStats.mtimeMs,
  };
  const fingerprint = createHash("sha256");

  async function walk(current: string): Promise<void> {
    assertPathInside(root, current);
    const entries = (await readdir(current, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    );

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      assertPathInside(root, entryPath);

      if (entry.isSymbolicLink()) {
        throw new AppError(
          "UNSUPPORTED_SAVE_ENTRY",
          "O save contém um atalho simbólico e não pode ser copiado com segurança.",
          422,
        );
      }

      if (entry.isDirectory()) {
        fingerprint.update(`d:${path.relative(root, entryPath)}\0`);
        totals.directoryCount += 1;
        await walk(entryPath);
        continue;
      }

      if (entry.isFile()) {
        const stats = await lstat(entryPath);
        fingerprint.update(
          `f:${path.relative(root, entryPath)}:${stats.size}\0`,
        );
        totals.size += stats.size;
        totals.fileCount += 1;
        totals.lastModifiedMs = Math.max(totals.lastModifiedMs, stats.mtimeMs);
      }
    }
  }

  await walk(path.resolve(root));
  return { ...totals, fingerprint: fingerprint.digest("hex") };
}
