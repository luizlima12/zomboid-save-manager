import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildRecoveryLua,
  RECOVERY_MOD_INFO,
} from "@/lib/recovery/recovery-lua";
import { assertPathInside } from "@/lib/security/safe-path";
import type { RecoveryRecord } from "@/lib/types";
import { getRecoveryModPath } from "@/lib/zomboid/paths";

export async function installRecoveryScript(
  recovery: Pick<RecoveryRecord, "id" | "characterName">,
  saveName: string,
  modRoot = getRecoveryModPath(),
): Promise<void> {
  const lua = buildRecoveryLua(recovery, saveName);
  const versionRoots = [modRoot, path.join(modRoot, "42")];

  for (const versionRoot of versionRoots) {
    const luaDirectory = path.join(versionRoot, "media", "lua", "client");
    const infoPath = path.join(versionRoot, "mod.info");
    const luaPath = path.join(luaDirectory, "ZSMRecovery.lua");
    assertPathInside(modRoot, infoPath);
    assertPathInside(modRoot, luaPath);
    await mkdir(luaDirectory, { recursive: true });
    await Promise.all([
      writeFile(infoPath, RECOVERY_MOD_INFO, "utf8"),
      writeFile(luaPath, lua, "utf8"),
    ]);
  }
}

export async function disableRecoveryScript(
  recoveryId: string,
  modRoot = getRecoveryModPath(),
): Promise<void> {
  const versionRoots = [modRoot, path.join(modRoot, "42")];
  for (const versionRoot of versionRoots) {
    const luaPath = path.join(
      versionRoot,
      "media",
      "lua",
      "client",
      "ZSMRecovery.lua",
    );
    assertPathInside(modRoot, luaPath);
    try {
      const current = await readFile(luaPath, "utf8");
      if (current.includes(recoveryId)) {
        await writeFile(
          luaPath,
          "-- Recovery completed or rolled back. No pending operation.\n",
          "utf8",
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
