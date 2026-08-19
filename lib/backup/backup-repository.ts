import { getAppDirectories } from "@/lib/config/config";
import { readJsonFile, writeJsonAtomic } from "@/lib/filesystem/atomic-json";
import type { BackupMetadata } from "@/lib/types";

export async function readBackupMetadata(
  metadataFile = getAppDirectories().backupMetadataFile,
): Promise<BackupMetadata[]> {
  const backups = await readJsonFile<BackupMetadata[]>(metadataFile, []);
  return backups.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function addBackupMetadata(
  backup: BackupMetadata,
  metadataFile = getAppDirectories().backupMetadataFile,
): Promise<void> {
  const backups = await readBackupMetadata(metadataFile);
  await writeJsonAtomic(metadataFile, [backup, ...backups]);
}
