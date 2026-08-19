export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ZomboidSave {
  id: string;
  name: string;
  gameMode: string;
  lastModified: string;
  size: number;
  fileCount: number;
}

export interface SaveRecord extends ZomboidSave {
  path: string;
}

export type BackupType =
  | "manual"
  | "automatic"
  | "pre-restore"
  | "pre-recovery";

export interface BackupMetadata {
  id: string;
  saveId: string;
  saveName: string;
  gameMode: string;
  createdAt: string;
  size: number;
  fileCount: number;
  favorite: boolean;
  type: BackupType;
  label?: string;
}

export interface AppConfig {
  zomboidSavesPath: string;
  backupPath: string;
  maxAutomaticBackups: number;
  backupBeforeLaunch: boolean;
  deleteOldBackups: boolean;
  gameExecutablePath?: string;
  enableCharacterRecovery: boolean;
}

export type Operation =
  | "backup"
  | "restore"
  | "recovery"
  | "delete"
  | "launch"
  | null;

export type RecoveryMode = "revive" | "full-health";

export type RecoveryStatus =
  | "backup-created"
  | "database-updated"
  | "waiting-game-launch"
  | "waiting-player-load"
  | "completed"
  | "failed"
  | "rolled-back";

export interface Character {
  id: string;
  saveId: string;
  name: string;
  dead: boolean;
  source: "local" | "hosted";
}

export interface CharacterScan {
  saveId: string;
  saveName: string;
  gameMode: string;
  compatible: boolean;
  characters: Character[];
}

export interface RecoveryRecord {
  id: string;
  saveId: string;
  characterId: string;
  characterName: string;
  mode: RecoveryMode;
  status: RecoveryStatus;
  backupId: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}
