import { File } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BlobReader,
  BlobWriter,
  type FileEntry,
  TextWriter,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertLocalRuntime,
  resolveRuntimeMode,
} from "@/lib/runtime/runtime-mode";
import {
  importDirectoryFiles,
  importZipFile,
} from "@/lib/web/import-save";
import { generateSavePackage } from "@/lib/web/package-save";
import {
  recoverPlayersDatabase,
  scanPlayersDatabase,
} from "@/lib/web/sqlite-engine";

const wasmPath = path.resolve("node_modules", "sql.js", "dist", "sql-wasm.wasm");

describe("hosted web runtime", () => {
  let testRoot: string;
  let databaseBytes: Uint8Array;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(os.tmpdir(), "zsm-web-test-"));
    const databasePath = path.join(testRoot, "players.db");
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE localPlayers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        isDead INTEGER NOT NULL,
        x REAL,
        y REAL,
        z REAL,
        data BLOB
      );
      INSERT INTO localPlayers (name, isDead, x, y, z)
      VALUES ('Web Survivor', 1, 10635.5, 9954, 0);
    `);
    database.close();
    databaseBytes = new Uint8Array(await readFile(databasePath));
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  function browserFile(
    parts: ConstructorParameters<typeof File>[0],
    name: string,
  ): globalThis.File {
    return new File(parts, name) as unknown as globalThis.File;
  }

  function databaseArrayBuffer(): ArrayBuffer {
    return databaseBytes.buffer.slice(
      databaseBytes.byteOffset,
      databaseBytes.byteOffset + databaseBytes.byteLength,
    ) as ArrayBuffer;
  }

  it("detects Vercel and supports an explicit override", () => {
    expect(resolveRuntimeMode({ VERCEL: "1" })).toBe("web");
    expect(resolveRuntimeMode({ VERCEL_ENV: "production" })).toBe("web");
    expect(
      resolveRuntimeMode({ VERCEL: "1", ZSM_RUNTIME_MODE: "local" }),
    ).toBe("local");
    expect(() => assertLocalRuntime({ VERCEL: "1" })).toThrowError(
      /aplicativo local/i,
    );
  });

  it("scans and recovers a copied database without modifying the original", async () => {
    const original = databaseBytes.slice();
    const characters = await scanPlayersDatabase(
      databaseBytes,
      "web-save-test",
      wasmPath,
    );
    expect(characters[0]).toMatchObject({
      name: "Web Survivor",
      dead: true,
      position: { x: 10635.5, y: 9954, z: 0 },
    });

    const recovered = await recoverPlayersDatabase(
      databaseBytes,
      "web-save-test",
      characters[0].id,
      wasmPath,
    );
    expect(recovered.characters[0].dead).toBe(false);
    expect(databaseBytes).toEqual(original);
    await expect(
      scanPlayersDatabase(recovered.database, "web-save-test", wasmPath),
    ).resolves.toMatchObject([{ dead: false }]);
  });

  it("keeps scanning saves that do not expose position columns", async () => {
    const legacyPath = path.join(testRoot, "legacy-players.db");
    const legacyDatabase = new DatabaseSync(legacyPath);
    legacyDatabase.exec(`
      CREATE TABLE localPlayers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        isDead INTEGER NOT NULL,
        data BLOB
      );
      INSERT INTO localPlayers (name, isDead) VALUES ('Legacy Survivor', 0);
    `);
    legacyDatabase.close();

    const [character] = await scanPlayersDatabase(
      new Uint8Array(await readFile(legacyPath)),
      "legacy-save-test",
      wasmPath,
    );

    expect(character).toMatchObject({ name: "Legacy Survivor", dead: false });
    expect(character.position).toBeUndefined();
  });

  it("imports a complete folder and rejects multiple saves", async () => {
    const workspace = await importDirectoryFiles([
      browserFile([databaseArrayBuffer()], "players.db"),
      browserFile(["version"], "map_ver.bin"),
      browserFile(["chunk"], "map_10_10.bin"),
    ]);
    expect(workspace).toMatchObject({
      name: "IMPORTED_SAVE",
      playersDbPath: "players.db",
    });
    expect(workspace.entries).toHaveLength(3);

    await expect(
      importDirectoryFiles([
        browserFile([databaseArrayBuffer()], "players.db"),
        browserFile([databaseArrayBuffer()], "nested/players.db"),
        browserFile(["version"], "map_ver.bin"),
      ]),
    ).rejects.toThrow(/mais de um save/i);
  });

  it("imports a ZIP and generates a recovery package with manifest and mod", async () => {
    const inputWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(inputWriter);
    await zipWriter.add(
      "MY_SAVE/players.db",
      new BlobReader(new Blob([databaseArrayBuffer()])),
    );
    await zipWriter.add("MY_SAVE/map_ver.bin", new BlobReader(new Blob(["version"])));
    await zipWriter.close();
    const inputZip = browserFile([await inputWriter.getData()], "MY_SAVE.zip");
    const workspace = await importZipFile(inputZip);
    const characters = await scanPlayersDatabase(
      workspace.originalPlayersDb,
      workspace.id,
      wasmPath,
    );
    const recovered = await recoverPlayersDatabase(
      workspace.originalPlayersDb,
      workspace.id,
      characters[0].id,
      wasmPath,
    );

    const result = await generateSavePackage({
      workspace: { ...workspace, characters },
      target: { filename: "recovered.zip" },
      mode: "full-health",
      characterName: characters[0].name,
      recoveredPlayersDb: recovered.database,
      onProgress: () => undefined,
    });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.manifest.originalUntouched).toBe(true);
    expect(result.manifest.originalPlayersDbSha256).not.toBe(
      result.manifest.outputPlayersDbSha256,
    );

    const outputReader = new ZipReader(new BlobReader(result.blob!));
    const entries = await outputReader.getEntries();
    const names = entries.map((entry) => entry.filename);
    expect(names).toContain("save/MY_SAVE/players.db");
    expect(names).toContain("manifest.json");
    expect(names).toContain(
      "mod/ZomboidSaveManagerRecovery/media/lua/client/ZSMRecovery.lua",
    );
    const manifestEntry = entries.find(
      (entry) => entry.filename === "manifest.json",
    ) as FileEntry;
    expect(JSON.parse(await manifestEntry.getData(new TextWriter()))).toMatchObject({
      mode: "full-health",
      saveName: "MY_SAVE",
    });
    const outputDbEntry = entries.find(
      (entry) => entry.filename === "save/MY_SAVE/players.db",
    ) as FileEntry;
    const outputDb = await outputDbEntry.getData(
      new Uint8ArrayWriter(),
    );
    await expect(
      scanPlayersDatabase(outputDb, workspace.id, wasmPath),
    ).resolves.toMatchObject([{ dead: false }]);
    await outputReader.close();
  });

  it("rejects ZIP traversal and incomplete saves", async () => {
    const unsafeWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(unsafeWriter);
    await zipWriter.add(
      "../players.db",
      new BlobReader(new Blob([databaseArrayBuffer()])),
    );
    await zipWriter.add("map_ver.bin", new BlobReader(new Blob(["version"])));
    await zipWriter.close();
    await expect(
      importZipFile(browserFile([await unsafeWriter.getData()], "unsafe.zip")),
    ).rejects.toThrow();

    await expect(
      importDirectoryFiles([browserFile([databaseArrayBuffer()], "players.db")]),
    ).rejects.toThrow(/save completo/i);
  });
});
