import { randomUUID } from "node:crypto";
import { cp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { addBackupMetadata } from "@/lib/backup/backup-repository";
import { AppError } from "@/lib/errors";
import { inspectDirectory } from "@/lib/filesystem/directory-inspection";
import { withOperationLock } from "@/lib/operations/operation-lock";
import { assertPathInside } from "@/lib/security/safe-path";
import { resolveSaveById } from "@/lib/saves/list-saves";
import type { AppConfig, BackupMetadata, BackupType } from "@/lib/types";

export interface CreateBackupOptions {
  type?: BackupType;
  label?: string;
  favorite?: boolean;
}

export interface CreateBackupContext {
  config: AppConfig;
  metadataFile?: string;
}

function validateLabel(label?: string): string | undefined {
  const normalized = label?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 80) {
    throw new AppError(
      "INVALID_BACKUP_LABEL",
      "O nome do backup deve ter no máximo 80 caracteres.",
      400,
    );
  }
  return normalized;
}

export async function createBackup(
  saveId: string,
  options: CreateBackupOptions,
  context: CreateBackupContext,
): Promise<BackupMetadata> {
  return withOperationLock("backup", () =>
    createBackupWithinLockedOperation(saveId, options, context),
  );
}

export async function createBackupWithinLockedOperation(
  saveId: string,
  options: CreateBackupOptions,
  context: CreateBackupContext,
): Promise<BackupMetadata> {
    const { config, metadataFile } = context;
    const save = await resolveSaveById(config, saveId);
    if (!save) {
      throw new AppError(
        "SAVE_NOT_FOUND",
        "Este save não foi encontrado. Atualize a lista e tente novamente.",
        404,
      );
    }

    const backupId = `backup_${randomUUID()}`;
    const saveBackupRoot = path.join(config.backupPath, save.id);
    const tempPath = path.join(saveBackupRoot, `.${backupId}.tmp`);
    const finalPath = path.join(saveBackupRoot, backupId);
    assertPathInside(config.zomboidSavesPath, save.path);
    assertPathInside(config.backupPath, saveBackupRoot);
    assertPathInside(config.backupPath, tempPath);
    assertPathInside(config.backupPath, finalPath);

    await mkdir(saveBackupRoot, { recursive: true });

    try {
      const sourceInspection = await inspectDirectory(save.path);
      await cp(save.path, tempPath, {
        recursive: true,
        force: false,
        errorOnExist: true,
        preserveTimestamps: true,
      });

      const copiedInspection = await inspectDirectory(tempPath);
      const sourceInspectionAfterCopy = await inspectDirectory(save.path);
      const isValid =
        sourceInspection.fingerprint === sourceInspectionAfterCopy.fingerprint &&
        sourceInspection.size === copiedInspection.size &&
        sourceInspection.fileCount === copiedInspection.fileCount &&
        sourceInspection.directoryCount === copiedInspection.directoryCount &&
        sourceInspection.fingerprint === copiedInspection.fingerprint;

      if (!isValid) {
        throw new AppError(
          "BACKUP_VALIDATION_FAILED",
          "A cópia não passou na validação. O backup incompleto foi descartado.",
          500,
        );
      }

      await rename(tempPath, finalPath);

      const backup: BackupMetadata = {
        id: backupId,
        saveId: save.id,
        saveName: save.name,
        gameMode: save.gameMode,
        createdAt: new Date().toISOString(),
        size: copiedInspection.size,
        fileCount: copiedInspection.fileCount,
        favorite: options.favorite ?? false,
        type: options.type ?? "manual",
        label: validateLabel(options.label),
      };

      try {
        await addBackupMetadata(backup, metadataFile);
      } catch (error) {
        await rm(finalPath, { recursive: true, force: true });
        throw error;
      }

      return backup;
    } catch (error) {
      await rm(tempPath, { recursive: true, force: true });
      throw error;
    }
}
