import { readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { inspectDirectory } from "@/lib/filesystem/directory-inspection";
import { assertPathInside } from "@/lib/security/safe-path";
import { createSaveId } from "@/lib/saves/save-registry";
import type { AppConfig, SaveRecord, ZomboidSave } from "@/lib/types";

async function readDirectories(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function listSaveRecords(config: AppConfig): Promise<SaveRecord[]> {
  const savesRoot = path.resolve(config.zomboidSavesPath);
  const modes = await readDirectories(savesRoot);
  const saves: SaveRecord[] = [];

  for (const gameMode of modes) {
    const modePath = path.join(savesRoot, gameMode);
    assertPathInside(savesRoot, modePath);
    const saveNames = await readDirectories(modePath);

    for (const name of saveNames) {
      const candidatePath = path.join(modePath, name);
      assertPathInside(savesRoot, candidatePath);
      const resolvedPath = await realpath(candidatePath);
      assertPathInside(savesRoot, resolvedPath);
      const inspection = await inspectDirectory(resolvedPath);

      if (inspection.fileCount === 0) continue;

      saves.push({
        id: createSaveId(gameMode, name),
        name,
        gameMode,
        path: resolvedPath,
        lastModified: new Date(inspection.lastModifiedMs).toISOString(),
        size: inspection.size,
        fileCount: inspection.fileCount,
      });
    }
  }

  return saves.sort(
    (a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified),
  );
}

export async function listSaves(config: AppConfig): Promise<ZomboidSave[]> {
  const saves = await listSaveRecords(config);
  return saves.map((save) => ({
    id: save.id,
    name: save.name,
    gameMode: save.gameMode,
    lastModified: save.lastModified,
    size: save.size,
    fileCount: save.fileCount,
  }));
}

export async function resolveSaveById(
  config: AppConfig,
  saveId: string,
): Promise<SaveRecord | undefined> {
  const saves = await listSaveRecords(config);
  return saves.find((save) => save.id === saveId);
}
