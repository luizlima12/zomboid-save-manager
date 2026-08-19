import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBackup } from "@/lib/backup/create-backup";
import { listBackups } from "@/lib/backup/list-backups";
import { listSaveRecords, listSaves } from "@/lib/saves/list-saves";
import type { AppConfig } from "@/lib/types";

describe("save discovery and backup", () => {
  let testRoot: string;
  let config: AppConfig;
  let metadataFile: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(os.tmpdir(), "zsm-test-"));
    const savePath = path.join(testRoot, "saves", "Sandbox", "FelipeGame");
    await mkdir(path.join(savePath, "map"), { recursive: true });
    await writeFile(path.join(savePath, "map_ver.bin"), "version-1", "utf8");
    await writeFile(path.join(savePath, "map", "chunk.bin"), "safe-save-data", "utf8");

    config = {
      zomboidSavesPath: path.join(testRoot, "saves"),
      backupPath: path.join(testRoot, "backups"),
      maxAutomaticBackups: 10,
      backupBeforeLaunch: true,
      deleteOldBackups: true,
      enableCharacterRecovery: false,
    };
    metadataFile = path.join(testRoot, "data", "backups.json");
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it("discovers modes dynamically and hides server paths", async () => {
    const records = await listSaveRecords(config);
    const publicSaves = await listSaves(config);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ name: "FelipeGame", gameMode: "Sandbox", fileCount: 2 });
    expect(records[0].path).toContain("FelipeGame");
    expect(publicSaves[0]).not.toHaveProperty("path");
  });

  it("creates validated backups and records metadata", async () => {
    const [save] = await listSaves(config);
    const first = await createBackup(
      save.id,
      { label: "Base pronta", type: "manual" },
      { config, metadataFile },
    );
    const second = await createBackup(
      save.id,
      { label: "Antes de sair", type: "manual" },
      { config, metadataFile },
    );

    const copiedFile = path.join(config.backupPath, save.id, first.id, "map", "chunk.bin");
    expect(await readFile(copiedFile, "utf8")).toBe("safe-save-data");
    expect(first.fileCount).toBe(2);
    expect(second.id).not.toBe(first.id);

    const history = await listBackups(save.id, metadataFile);
    expect(history).toHaveLength(2);
    expect(history.map((backup) => backup.label)).toEqual([
      "Antes de sair",
      "Base pronta",
    ]);
  });

  it("does not write anything for an unknown save id", async () => {
    await expect(
      createBackup("save_0000000000000000", {}, { config, metadataFile }),
    ).rejects.toMatchObject({ code: "SAVE_NOT_FOUND" });
    await expect(listBackups(undefined, metadataFile)).resolves.toEqual([]);
  });
});
