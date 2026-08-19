import { open, stat } from "node:fs/promises";

import { getAppDirectories } from "@/lib/config/config";
import { disableRecoveryScript } from "@/lib/recovery/install-recovery-script";
import {
  getRecoveryRecord,
  saveRecoveryRecord,
} from "@/lib/recovery/recovery-history";
import type { RecoveryRecord } from "@/lib/types";
import { getZomboidConsolePath } from "@/lib/zomboid/paths";
import { getCachedProjectZomboidRunning } from "@/lib/zomboid/process";

const MAX_LOG_BYTES = 1024 * 1024;

async function readConsoleTail(consolePath: string): Promise<string> {
  try {
    const fileStats = await stat(consolePath);
    const length = Math.min(fileStats.size, MAX_LOG_BYTES);
    const start = Math.max(0, fileStats.size - length);
    const buffer = Buffer.alloc(length);
    const handle = await open(consolePath, "r");
    try {
      await handle.read(buffer, 0, length, start);
      return buffer.toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export interface RecoveryStatusContext {
  historyFile?: string;
  consolePath?: string;
  gameRunningCheck?: () => Promise<boolean>;
  disableScript?: typeof disableRecoveryScript;
  now?: () => Date;
}

export async function synchronizeRecoveryStatus(
  recoveryId: string,
  context: RecoveryStatusContext = {},
): Promise<RecoveryRecord> {
  const {
    historyFile = getAppDirectories().recoveryHistoryFile,
    consolePath = getZomboidConsolePath(),
    gameRunningCheck = getCachedProjectZomboidRunning,
    disableScript = disableRecoveryScript,
    now = () => new Date(),
  } = context;
  const recovery = await getRecoveryRecord(recoveryId, historyFile);
  if (
    !["waiting-game-launch", "waiting-player-load"].includes(recovery.status)
  ) {
    return recovery;
  }

  const consoleTail = await readConsoleTail(consolePath);
  const completedMarker = `ZSM_RECOVERY_COMPLETE|${recovery.id}`;
  const failedMarker = `ZSM_RECOVERY_FAILED|${recovery.id}|`;

  if (consoleTail.includes(completedMarker)) {
    const completed: RecoveryRecord = {
      ...recovery,
      status: "completed",
      updatedAt: now().toISOString(),
    };
    await saveRecoveryRecord(completed, historyFile);
    await disableScript(recovery.id);
    return completed;
  }

  if (consoleTail.includes(failedMarker)) {
    const failed: RecoveryRecord = {
      ...recovery,
      status: "failed",
      updatedAt: now().toISOString(),
      errorMessage: "O Recovery Mod não conseguiu restaurar a saúde do personagem.",
    };
    await saveRecoveryRecord(failed, historyFile);
    await disableScript(recovery.id);
    return failed;
  }

  if (recovery.status === "waiting-game-launch") {
    try {
      if (await gameRunningCheck()) {
        const waiting: RecoveryRecord = {
          ...recovery,
          status: "waiting-player-load",
          updatedAt: now().toISOString(),
        };
        await saveRecoveryRecord(waiting, historyFile);
        return waiting;
      }
    } catch {
      return recovery;
    }
  }
  return recovery;
}
