import os from "node:os";
import path from "node:path";

function getUserProfile(): string {
  return process.env.USERPROFILE ?? os.homedir();
}

export function getZomboidUserPath(): string {
  return path.join(getUserProfile(), "Zomboid");
}

export function getRecoveryModPath(): string {
  return path.join(
    getZomboidUserPath(),
    "mods",
    "ZomboidSaveManagerRecovery",
  );
}

export function getZomboidConsolePath(): string {
  return path.join(getZomboidUserPath(), "console.txt");
}
