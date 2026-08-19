import { z } from "zod";

export const appConfigSchema = z.object({
  zomboidSavesPath: z.string().trim().min(1).max(1024),
  backupPath: z.string().trim().min(1).max(1024),
  maxAutomaticBackups: z.number().int().min(1).max(100),
  backupBeforeLaunch: z.boolean(),
  deleteOldBackups: z.boolean(),
  gameExecutablePath: z.string().trim().max(1024).optional(),
  enableCharacterRecovery: z.boolean(),
});

export const appConfigUpdateSchema = appConfigSchema.pick({
  zomboidSavesPath: true,
  backupPath: true,
  maxAutomaticBackups: true,
  backupBeforeLaunch: true,
  deleteOldBackups: true,
  enableCharacterRecovery: true,
});
