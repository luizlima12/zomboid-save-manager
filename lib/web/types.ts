import type { Character, RecoveryMode } from "@/lib/types";

export interface BrowserSaveEntry {
  path: string;
  size: number;
  lastModified: number;
  getBlob: () => Promise<Blob>;
}

export interface BrowserSaveWorkspace {
  id: string;
  name: string;
  gameMode: "Imported";
  sourceType: "directory" | "directory-input" | "zip";
  importedAt: string;
  entries: BrowserSaveEntry[];
  playersDbPath: string;
  mapVersionPath: string;
  originalPlayersDb: Uint8Array;
  characters: Character[];
  size: number;
  cleanup: () => Promise<void>;
}

export type WebOperationStage =
  | "idle"
  | "reading"
  | "validating"
  | "sqlite"
  | "hashing"
  | "packing"
  | "saving"
  | "complete";

export interface WebOperationProgress {
  stage: WebOperationStage;
  percent: number;
  message: string;
}

export interface WebRecoveryHistory {
  id: string;
  characterName: string;
  mode: RecoveryMode;
  createdAt: string;
  packageName: string;
  originalHash: string;
  recoveredHash: string;
}

export interface RecoveryPackageManifest {
  formatVersion: 1;
  generatedBy: "Zomboid Save Manager Web";
  saveName: string;
  characterName?: string;
  mode: "backup" | RecoveryMode;
  createdAt: string;
  originalPlayersDbSha256: string;
  outputPlayersDbSha256: string;
  originalUntouched: true;
  files: Array<{ path: string; size: number }>;
}

export interface SaveWorkerRequest {
  requestId: string;
  action: "scan" | "recover";
  database: ArrayBuffer;
  saveId: string;
  characterId?: string;
}

export interface SaveWorkerSuccess {
  requestId: string;
  success: true;
  characters: Character[];
  database?: ArrayBuffer;
}

export interface SaveWorkerFailure {
  requestId: string;
  success: false;
  error: string;
}

export type SaveWorkerResponse = SaveWorkerSuccess | SaveWorkerFailure;
