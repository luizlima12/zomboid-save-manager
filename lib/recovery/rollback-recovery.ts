import { randomUUID } from "node:crypto";
import { copyFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import { PlayersRepository } from "@/lib/character/players-repository";
import { resolvePlayersDbPath } from "@/lib/character/list-characters";
import { getAppDirectories } from "@/lib/config/config";
import { AppError } from "@/lib/errors";
import { withOperationLock } from "@/lib/operations/operation-lock";
import { disableRecoveryScript } from "@/lib/recovery/install-recovery-script";
import {
  getRecoveryRecord,
  saveRecoveryRecord,
} from "@/lib/recovery/recovery-history";
import { assertPathInside } from "@/lib/security/safe-path";
import type { AppConfig, RecoveryRecord } from "@/lib/types";
import { isProjectZomboidRunning } from "@/lib/zomboid/process";

export interface RollbackRecoveryContext {
  config: AppConfig;
  historyFile?: string;
  recoveryRoot?: string;
  gameRunningCheck?: () => Promise<boolean>;
  disableScript?: typeof disableRecoveryScript;
  now?: () => Date;
}

function validateDatabase(databasePath: string): void {
  let repository: PlayersRepository | undefined;
  try {
    repository = new PlayersRepository(databasePath, true);
    repository.validateIntegrity();
    repository.getSupportedSchemas();
  } finally {
    repository?.close();
  }
}

export async function rollbackRecovery(
  recoveryId: string,
  context: RollbackRecoveryContext,
): Promise<RecoveryRecord> {
  return withOperationLock("recovery", async () => {
    const {
      config,
      historyFile = getAppDirectories().recoveryHistoryFile,
      recoveryRoot = getAppDirectories().recovery,
      gameRunningCheck = isProjectZomboidRunning,
      disableScript = disableRecoveryScript,
      now = () => new Date(),
    } = context;
    const recovery = await getRecoveryRecord(recoveryId, historyFile);
    if (recovery.status === "rolled-back") return recovery;

    let running: boolean;
    try {
      running = await gameRunningCheck();
    } catch (error) {
      throw new AppError(
        "GAME_STATUS_UNAVAILABLE",
        "Não foi possível confirmar se o jogo está fechado. O rollback foi bloqueado.",
        503,
        { cause: error },
      );
    }
    if (running) {
      throw new AppError(
        "GAME_RUNNING",
        "Feche o Project Zomboid antes de desfazer a recuperação.",
        409,
      );
    }

    const resolved = await resolvePlayersDbPath(config, recovery.saveId);
    const recoveryDirectory = path.join(recoveryRoot, recovery.id);
    const backupPath = path.join(
      recoveryDirectory,
      "players.db.pre-recovery.bak",
    );
    const beforeRollbackPath = path.join(
      recoveryDirectory,
      "players.db.before-rollback.bak",
    );
    const token = randomUUID();
    const tempPath = path.join(
      path.dirname(resolved.databasePath),
      `.players.db.${token}.rollback-tmp`,
    );
    const oldPath = path.join(
      path.dirname(resolved.databasePath),
      `.players.db.${token}.rollback-old`,
    );
    assertPathInside(recoveryRoot, backupPath);
    assertPathInside(recoveryRoot, beforeRollbackPath);
    assertPathInside(path.dirname(resolved.databasePath), tempPath);
    assertPathInside(path.dirname(resolved.databasePath), oldPath);

    validateDatabase(backupPath);
    await copyFile(resolved.databasePath, beforeRollbackPath);
    await copyFile(backupPath, tempPath);
    validateDatabase(tempPath);

    try {
      await rename(resolved.databasePath, oldPath);
      try {
        await rename(tempPath, resolved.databasePath);
      } catch (error) {
        await rename(oldPath, resolved.databasePath);
        throw error;
      }
      validateDatabase(resolved.databasePath);
      await rm(oldPath, { force: true });
    } catch (error) {
      await rm(tempPath, { force: true });
      throw new AppError(
        "RECOVERY_ROLLBACK_FAILED",
        "Não foi possível restaurar players.db. O backup original permanece preservado.",
        500,
        { cause: error },
      );
    }

    const rolledBack: RecoveryRecord = {
      ...recovery,
      status: "rolled-back",
      updatedAt: now().toISOString(),
    };
    await saveRecoveryRecord(rolledBack, historyFile);
    await disableScript(recovery.id);
    return rolledBack;
  });
}
