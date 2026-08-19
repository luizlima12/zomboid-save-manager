import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listBackups } from "@/lib/backup/list-backups";
import { listCharacters } from "@/lib/character/list-characters";
import { recoverCharacter } from "@/lib/recovery/recover-character";
import { listRecoveryHistory } from "@/lib/recovery/recovery-history";
import { rollbackRecovery } from "@/lib/recovery/rollback-recovery";
import { synchronizeRecoveryStatus } from "@/lib/recovery/recovery-status";
import { buildRecoveryLua } from "@/lib/recovery/install-recovery-script";
import { listSaves } from "@/lib/saves/list-saves";
import type { AppConfig } from "@/lib/types";

const RECOVERY_ID = "recovery_00000000-0000-4000-8000-000000000001";

describe("character recovery", () => {
  let testRoot: string;
  let savePath: string;
  let databasePath: string;
  let metadataFile: string;
  let historyFile: string;
  let recoveryRoot: string;
  let config: AppConfig;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(os.tmpdir(), "zsm-recovery-test-"));
    savePath = path.join(testRoot, "saves", "Sandbox", "RECOVERY_TEST");
    databasePath = path.join(savePath, "players.db");
    metadataFile = path.join(testRoot, "data", "backups.json");
    historyFile = path.join(testRoot, "data", "recoveries.json");
    recoveryRoot = path.join(testRoot, "recovery");
    await mkdir(savePath, { recursive: true });
    await writeFile(path.join(savePath, "map_ver.bin"), "fixture", "utf8");

    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE localPlayers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        isDead INTEGER NOT NULL,
        data BLOB
      );
      INSERT INTO localPlayers (name, isDead, data)
      VALUES ('Luiz Felipe', 1, X'010203');
    `);
    database.close();

    config = {
      zomboidSavesPath: path.join(testRoot, "saves"),
      backupPath: path.join(testRoot, "backups"),
      maxAutomaticBackups: 10,
      backupBeforeLaunch: true,
      deleteOldBackups: true,
      enableCharacterRecovery: true,
    };
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  function readDeadState(databaseFile = databasePath): number {
    const database = new Database(databaseFile, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      return (
        database.prepare("SELECT isDead FROM localPlayers LIMIT 1").get() as {
          isDead: number;
        }
      ).isDead;
    } finally {
      database.close();
    }
  }

  async function getTarget() {
    const [save] = await listSaves(config);
    const scan = await listCharacters(config, save.id);
    return { save, character: scan.characters[0] };
  }

  const quietAudit = vi.fn(async () => undefined);

  it("revives a dead character only after both backups", async () => {
    const { save, character } = await getTarget();
    const recovery = await recoverCharacter(
      { saveId: save.id, characterId: character.id, mode: "revive" },
      {
        config,
        metadataFile,
        historyFile,
        recoveryRoot,
        gameRunningCheck: async () => false,
        recoveryIdFactory: () => RECOVERY_ID,
        auditLog: quietAudit,
      },
    );

    expect(recovery.status).toBe("completed");
    expect(readDeadState()).toBe(0);

    const [backup] = await listBackups(save.id, metadataFile);
    expect(backup).toMatchObject({ type: "pre-recovery", favorite: true });
    const sqliteBackup = path.join(
      recoveryRoot,
      RECOVERY_ID,
      "players.db.pre-recovery.bak",
    );
    expect(readDeadState(sqliteBackup)).toBe(1);
    expect(await listRecoveryHistory(historyFile)).toHaveLength(1);
  });

  it("refuses recovery while the game is running without writing files", async () => {
    const { save, character } = await getTarget();
    await expect(
      recoverCharacter(
        { saveId: save.id, characterId: character.id, mode: "revive" },
        {
          config,
          metadataFile,
          historyFile,
          recoveryRoot,
          gameRunningCheck: async () => true,
          auditLog: quietAudit,
        },
      ),
    ).rejects.toMatchObject({ code: "GAME_RUNNING" });

    expect(readDeadState()).toBe(1);
    await expect(listBackups(undefined, metadataFile)).resolves.toEqual([]);
  });

  it("refuses a character that is already alive", async () => {
    const database = new Database(databasePath);
    database.prepare("UPDATE localPlayers SET isDead = 0").run();
    database.close();
    const { save, character } = await getTarget();

    await expect(
      recoverCharacter(
        { saveId: save.id, characterId: character.id, mode: "revive" },
        {
          config,
          metadataFile,
          historyFile,
          recoveryRoot,
          gameRunningCheck: async () => false,
          auditLog: quietAudit,
        },
      ),
    ).rejects.toMatchObject({ code: "CHARACTER_ALREADY_ALIVE" });
    await expect(listBackups(undefined, metadataFile)).resolves.toEqual([]);
  });

  it("prepares and completes a full-health one-shot recovery", async () => {
    const { save, character } = await getTarget();
    const installScript = vi.fn(async () => undefined);
    const disableScript = vi.fn(async () => undefined);
    const recovery = await recoverCharacter(
      { saveId: save.id, characterId: character.id, mode: "full-health" },
      {
        config,
        metadataFile,
        historyFile,
        recoveryRoot,
        gameRunningCheck: async () => false,
        recoveryIdFactory: () => RECOVERY_ID,
        installScript,
        auditLog: quietAudit,
      },
    );
    expect(recovery.status).toBe("waiting-game-launch");
    expect(installScript).toHaveBeenCalledOnce();

    const consolePath = path.join(testRoot, "console.txt");
    await writeFile(
      consolePath,
      `LOG : General > ZSM_RECOVERY_COMPLETE|${RECOVERY_ID}\n`,
      "utf8",
    );
    const completed = await synchronizeRecoveryStatus(RECOVERY_ID, {
      historyFile,
      consolePath,
      disableScript,
    });
    expect(completed.status).toBe("completed");
    expect(disableScript).toHaveBeenCalledWith(RECOVERY_ID);
  });

  it("rolls players.db back to its exact pre-recovery state", async () => {
    const { save, character } = await getTarget();
    await recoverCharacter(
      { saveId: save.id, characterId: character.id, mode: "revive" },
      {
        config,
        metadataFile,
        historyFile,
        recoveryRoot,
        gameRunningCheck: async () => false,
        recoveryIdFactory: () => RECOVERY_ID,
        auditLog: quietAudit,
      },
    );
    expect(readDeadState()).toBe(0);

    const rolledBack = await rollbackRecovery(RECOVERY_ID, {
      config,
      historyFile,
      recoveryRoot,
      gameRunningCheck: async () => false,
      disableScript: async () => undefined,
    });
    expect(rolledBack.status).toBe("rolled-back");
    expect(readDeadState()).toBe(1);
    await expect(
      readFile(
        path.join(
          recoveryRoot,
          RECOVERY_ID,
          "players.db.before-rollback.bak",
        ),
      ),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("rejects unknown and invalid players.db schemas", async () => {
    const database = new Database(databasePath);
    database.exec("DROP TABLE localPlayers; CREATE TABLE unknown (id INTEGER)");
    database.close();
    const [save] = await listSaves(config);

    await expect(listCharacters(config, save.id)).rejects.toMatchObject({
      code: "PLAYERS_DB_SCHEMA_UNSUPPORTED",
    });
  });

  it("refuses a missing or corrupt players.db", async () => {
    const [save] = await listSaves(config);
    await unlink(databasePath);
    await expect(listCharacters(config, save.id)).rejects.toMatchObject({
      code: "PLAYERS_DB_NOT_FOUND",
    });

    await writeFile(databasePath, "not-a-sqlite-database", "utf8");
    await expect(listCharacters(config, save.id)).rejects.toMatchObject({
      code: "PLAYERS_DB_INVALID",
    });
  });

  it("supports hosted characters stored in networkPlayers", async () => {
    const database = new Database(databasePath);
    database.exec(`
      DROP TABLE localPlayers;
      CREATE TABLE networkPlayers (
        name TEXT NOT NULL,
        username TEXT,
        isDead INTEGER NOT NULL,
        data BLOB
      );
      INSERT INTO networkPlayers (name, username, isDead)
      VALUES ('Hosted Survivor', 'host', 1);
    `);
    database.close();
    const [save] = await listSaves(config);
    const scan = await listCharacters(config, save.id);

    expect(scan.characters[0]).toMatchObject({
      name: "Hosted Survivor",
      dead: true,
      source: "hosted",
    });
  });

  it("generates a world-scoped, character-scoped, one-shot health script", () => {
    const lua = buildRecoveryLua(
      { id: RECOVERY_ID, characterName: "Luiz Felipe" },
      "RECOVERY_TEST",
    );

    expect(lua).toContain('local targetWorld = "RECOVERY_TEST"');
    expect(lua).toContain('local targetCharacter = "Luiz Felipe"');
    expect(lua).toContain("bodyDamage:RestoreToFullHealth()");
    expect(lua).toContain("bodyDamage:setInfected(false)");
    expect(lua).toContain("modData[appliedKey] = true");
    expect(lua).toContain(`ZSM_RECOVERY_COMPLETE|`);
  });
});
