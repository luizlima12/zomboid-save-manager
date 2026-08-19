import { randomUUID } from "node:crypto";

import { createBackupWithinLockedOperation } from "@/lib/backup/create-backup";
import { PlayersRepository } from "@/lib/character/players-repository";
import { resolvePlayersDbPath } from "@/lib/character/list-characters";
import { getAppDirectories } from "@/lib/config/config";
import { AppError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/logging/audit-log";
import { withOperationLock } from "@/lib/operations/operation-lock";
import { installRecoveryScript } from "@/lib/recovery/install-recovery-script";
import {
  isRecoveryPending,
  listRecoveryHistory,
  saveRecoveryRecord,
} from "@/lib/recovery/recovery-history";
import { createPlayersDbBackup } from "@/lib/recovery/sqlite-backup";
import type {
  AppConfig,
  RecoveryMode,
  RecoveryRecord,
} from "@/lib/types";
import { isProjectZomboidRunning } from "@/lib/zomboid/process";

export interface RecoveryServiceContext {
  config: AppConfig;
  metadataFile?: string;
  historyFile?: string;
  recoveryRoot?: string;
  gameRunningCheck?: () => Promise<boolean>;
  installScript?: typeof installRecoveryScript;
  auditLog?: typeof writeAuditLog;
  recoveryIdFactory?: () => string;
  now?: () => Date;
}

async function assertGameClosed(
  gameRunningCheck: () => Promise<boolean>,
): Promise<void> {
  let running: boolean;
  try {
    running = await gameRunningCheck();
  } catch (error) {
    throw new AppError(
      "GAME_STATUS_UNAVAILABLE",
      "Não foi possível confirmar se o Project Zomboid está fechado. A recuperação foi bloqueada.",
      503,
      { cause: error },
    );
  }
  if (running) {
    throw new AppError(
      "GAME_RUNNING",
      "Feche o Project Zomboid antes de recuperar um personagem.",
      409,
    );
  }
}

export async function recoverCharacter(
  input: { saveId: string; characterId: string; mode: RecoveryMode },
  context: RecoveryServiceContext,
): Promise<RecoveryRecord> {
  return withOperationLock("recovery", async () => {
    const {
      config,
      metadataFile,
      historyFile = getAppDirectories().recoveryHistoryFile,
      recoveryRoot = getAppDirectories().recovery,
      gameRunningCheck = isProjectZomboidRunning,
      installScript = installRecoveryScript,
      auditLog = writeAuditLog,
      recoveryIdFactory = () => `recovery_${randomUUID()}`,
      now = () => new Date(),
    } = context;

    if (!config.enableCharacterRecovery) {
      throw new AppError(
        "RECOVERY_DISABLED",
        "Ative o Character Recovery nas configurações antes de continuar.",
        403,
      );
    }

    await assertGameClosed(gameRunningCheck);
    const activeRecovery = (await listRecoveryHistory(historyFile)).find(
      isRecoveryPending,
    );
    if (activeRecovery) {
      throw new AppError(
        "RECOVERY_ALREADY_PENDING",
        "Já existe uma recuperação pendente. Conclua ou desfaça essa operação primeiro.",
        409,
      );
    }

    const resolved = await resolvePlayersDbPath(config, input.saveId);
    let repository: PlayersRepository | undefined;
    let character;
    try {
      repository = new PlayersRepository(resolved.databasePath, true);
      character = repository.findCharacter(input.saveId, input.characterId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PLAYERS_DB_INVALID",
        "Não foi possível validar players.db. A recuperação foi cancelada.",
        422,
        { cause: error },
      );
    } finally {
      repository?.close();
    }

    if (!character) {
      throw new AppError(
        "CHARACTER_NOT_FOUND",
        "O personagem não foi encontrado neste save.",
        404,
      );
    }
    if (!character.dead) {
      throw new AppError(
        "CHARACTER_ALREADY_ALIVE",
        "Este personagem já está vivo.",
        409,
      );
    }

    const recoveryId = recoveryIdFactory();
    const timestamp = now().toISOString();
    const backup = await createBackupWithinLockedOperation(
      input.saveId,
      {
        type: "pre-recovery",
        favorite: true,
        label: `Pre-Recovery — ${character.name}`,
      },
      { config, metadataFile },
    );

    let recovery: RecoveryRecord = {
      id: recoveryId,
      saveId: input.saveId,
      characterId: input.characterId,
      characterName: character.name,
      mode: input.mode,
      status: "backup-created",
      backupId: backup.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await saveRecoveryRecord(recovery, historyFile);
    await auditLog("recovery_backup_created", {
      recoveryId,
      saveId: input.saveId,
      backupId: backup.id,
    }).catch(console.error);

    try {
      await createPlayersDbBackup(
        resolved.databasePath,
        recoveryRoot,
        recoveryId,
      );

      if (input.mode === "full-health") {
        await installScript(recovery, resolved.saveName);
      }

      await assertGameClosed(gameRunningCheck);
      repository = new PlayersRepository(resolved.databasePath, false);
      try {
        const freshCharacter = repository.findCharacter(
          input.saveId,
          input.characterId,
        );
        if (!freshCharacter) {
          throw new AppError(
            "CHARACTER_NOT_FOUND",
            "O personagem não foi encontrado antes da transação.",
            404,
          );
        }
        repository.reviveCharacter(freshCharacter);
      } finally {
        repository.close();
        repository = undefined;
      }

      recovery = {
        ...recovery,
        status: input.mode === "full-health" ? "waiting-game-launch" : "completed",
        updatedAt: now().toISOString(),
      };
      await saveRecoveryRecord(recovery, historyFile);
      await auditLog("recovery_database_updated", {
        recoveryId,
        saveId: input.saveId,
        mode: input.mode,
      }).catch(console.error);
      return recovery;
    } catch (error) {
      recovery = {
        ...recovery,
        status: "failed",
        updatedAt: now().toISOString(),
        errorMessage:
          error instanceof AppError
            ? error.message
            : "A recuperação falhou após a criação do backup.",
      };
      await saveRecoveryRecord(recovery, historyFile).catch(console.error);
      await auditLog("recovery_failed", {
        recoveryId,
        saveId: input.saveId,
      }).catch(console.error);
      throw error;
    }
  });
}
