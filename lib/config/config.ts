import { access, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readJsonFile, writeJsonAtomic } from "@/lib/filesystem/atomic-json";
import { appConfigSchema } from "@/lib/config/schema";
import { AppError } from "@/lib/errors";
import { isPathInside } from "@/lib/security/safe-path";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";
import type { AppConfig } from "@/lib/types";

export interface AppDirectories {
  root: string;
  data: string;
  logs: string;
  recovery: string;
  configFile: string;
  backupMetadataFile: string;
  recoveryHistoryFile: string;
}

function getUserProfile(): string {
  return process.env.USERPROFILE ?? os.homedir();
}

export function getAppDirectories(): AppDirectories {
  const root = path.join(getUserProfile(), "ZomboidSaveManager");
  const data = path.join(root, "data");
  return {
    root,
    data,
    logs: path.join(root, "logs"),
    recovery: path.join(root, "recovery"),
    configFile: path.join(data, "config.json"),
    backupMetadataFile: path.join(data, "backups.json"),
    recoveryHistoryFile: path.join(data, "recoveries.json"),
  };
}

export function getDefaultConfig(): AppConfig {
  const profile = getUserProfile();
  return {
    zomboidSavesPath: path.join(profile, "Zomboid", "Saves"),
    backupPath: path.join(profile, "ZomboidSaveManager", "backups"),
    maxAutomaticBackups: 10,
    backupBeforeLaunch: true,
    deleteOldBackups: true,
    enableCharacterRecovery: true,
  };
}

export function validateConfigPaths(config: AppConfig): void {
  if (
    isPathInside(config.zomboidSavesPath, config.backupPath) ||
    isPathInside(config.backupPath, config.zomboidSavesPath)
  ) {
    throw new AppError(
      "OVERLAPPING_DIRECTORIES",
      "As pastas de saves e backups devem ficar em locais separados.",
      400,
    );
  }
}

export async function ensureAppDirectories(config: AppConfig): Promise<void> {
  const directories = getAppDirectories();
  await Promise.all([
    mkdir(directories.data, { recursive: true }),
    mkdir(directories.logs, { recursive: true }),
    mkdir(directories.recovery, { recursive: true }),
    mkdir(config.backupPath, { recursive: true }),
  ]);
}

export async function readConfig(): Promise<AppConfig> {
  assertLocalRuntime();
  const directories = getAppDirectories();
  const defaults = getDefaultConfig();
  let shouldWriteDefaults = false;
  try {
    await access(directories.configFile);
  } catch {
    shouldWriteDefaults = true;
  }
  const stored = await readJsonFile<unknown>(directories.configFile, defaults);
  const parsed = appConfigSchema.safeParse(stored);
  let config = parsed.success ? parsed.data : defaults;
  if (!parsed.success) shouldWriteDefaults = true;
  try {
    validateConfigPaths(config);
  } catch {
    config = defaults;
    shouldWriteDefaults = true;
  }

  await ensureAppDirectories(config);
  if (shouldWriteDefaults) await writeJsonAtomic(directories.configFile, config);
  return config;
}

export async function writeConfig(config: AppConfig): Promise<AppConfig> {
  assertLocalRuntime();
  const parsed = appConfigSchema.parse(config);
  validateConfigPaths(parsed);
  await ensureAppDirectories(parsed);
  await writeJsonAtomic(getAppDirectories().configFile, parsed);
  return parsed;
}
