import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { PlayersRepository } from "@/lib/character/players-repository";
import { AppError } from "@/lib/errors";
import { assertPathInside } from "@/lib/security/safe-path";

export async function createPlayersDbBackup(
  databasePath: string,
  recoveryRoot: string,
  recoveryId: string,
): Promise<string> {
  const recoveryDirectory = path.join(recoveryRoot, recoveryId);
  const backupPath = path.join(
    recoveryDirectory,
    "players.db.pre-recovery.bak",
  );
  assertPathInside(recoveryRoot, recoveryDirectory);
  assertPathInside(recoveryRoot, backupPath);
  await mkdir(recoveryDirectory, { recursive: true });
  await copyFile(databasePath, backupPath);

  const [sourceStats, backupStats] = await Promise.all([
    stat(databasePath),
    stat(backupPath),
  ]);
  if (sourceStats.size !== backupStats.size) {
    throw new AppError(
      "SQLITE_BACKUP_VALIDATION_FAILED",
      "O backup separado de players.db não passou na validação.",
      500,
    );
  }

  let repository: PlayersRepository | undefined;
  try {
    repository = new PlayersRepository(backupPath, true);
    repository.validateIntegrity();
    repository.getSupportedSchemas();
  } finally {
    repository?.close();
  }
  return backupPath;
}
