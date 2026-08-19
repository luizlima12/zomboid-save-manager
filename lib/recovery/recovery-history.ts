import { getAppDirectories } from "@/lib/config/config";
import { AppError } from "@/lib/errors";
import { readJsonFile, writeJsonAtomic } from "@/lib/filesystem/atomic-json";
import type { RecoveryRecord } from "@/lib/types";

export async function listRecoveryHistory(
  historyFile = getAppDirectories().recoveryHistoryFile,
): Promise<RecoveryRecord[]> {
  const recoveries = await readJsonFile<RecoveryRecord[]>(historyFile, []);
  return recoveries.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function saveRecoveryRecord(
  recovery: RecoveryRecord,
  historyFile = getAppDirectories().recoveryHistoryFile,
): Promise<void> {
  const history = await listRecoveryHistory(historyFile);
  const nextHistory = [
    recovery,
    ...history.filter((entry) => entry.id !== recovery.id),
  ];
  await writeJsonAtomic(historyFile, nextHistory);
}

export async function getRecoveryRecord(
  recoveryId: string,
  historyFile = getAppDirectories().recoveryHistoryFile,
): Promise<RecoveryRecord> {
  const recovery = (await listRecoveryHistory(historyFile)).find(
    (entry) => entry.id === recoveryId,
  );
  if (!recovery) {
    throw new AppError(
      "RECOVERY_NOT_FOUND",
      "Esta recuperação não foi encontrada.",
      404,
    );
  }
  return recovery;
}

export function isRecoveryPending(recovery: RecoveryRecord): boolean {
  return [
    "backup-created",
    "database-updated",
    "waiting-game-launch",
    "waiting-player-load",
  ].includes(recovery.status);
}
