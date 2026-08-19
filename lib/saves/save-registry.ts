import { createHash } from "node:crypto";
import path from "node:path";

export function createSaveId(gameMode: string, saveName: string): string {
  const identity = `${gameMode}/${saveName}`.replaceAll("\\", "/").toLowerCase();
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return `save_${digest}`;
}

export function getRelativeSaveIdentity(
  savesRoot: string,
  savePath: string,
): { gameMode: string; saveName: string } {
  const relative = path.relative(savesRoot, savePath);
  const [gameMode, saveName] = relative.split(path.sep);
  return { gameMode, saveName };
}
