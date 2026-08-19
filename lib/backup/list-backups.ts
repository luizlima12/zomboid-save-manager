import type { BackupMetadata } from "@/lib/types";
import { readBackupMetadata } from "@/lib/backup/backup-repository";

export async function listBackups(
  saveId?: string,
  metadataFile?: string,
): Promise<BackupMetadata[]> {
  const backups = await readBackupMetadata(metadataFile);
  return saveId
    ? backups.filter((backup) => backup.saveId === saveId)
    : backups;
}
