import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

import { readCharacterPosition } from "@/lib/character/character-position";
import type { Character } from "@/lib/types";

const TABLES = [
  { name: "localPlayers", source: "local" },
  { name: "networkPlayers", source: "hosted" },
] as const;

type SupportedWebTable = (typeof TABLES)[number] & { columns: string[] };

let sqlPromise: Promise<SqlJsStatic> | undefined;

async function loadSql(wasmUrl: string): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlPromise;
}

function firstColumnValues(database: Database, sql: string): unknown[] {
  const result = database.exec(sql)[0];
  return result?.values.map((row) => row[0]) ?? [];
}

function namedColumnValues(
  database: Database,
  sql: string,
  columnName: string,
): unknown[] {
  const result = database.exec(sql)[0];
  const index = result?.columns.indexOf(columnName) ?? -1;
  return index < 0 ? [] : result.values.map((row) => row[index]);
}

function assertIntegrity(database: Database): void {
  const result = firstColumnValues(database, "PRAGMA integrity_check");
  if (result.length !== 1 || result[0] !== "ok") {
    throw new Error(
      "players.db apresenta problemas de integridade. Nenhum arquivo foi alterado.",
    );
  }
}

function supportedTables(database: Database) {
  const existing = new Set(
    firstColumnValues(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    ).filter((value): value is string => typeof value === "string"),
  );
  const supported = TABLES.map((table) => {
    if (!existing.has(table.name)) return undefined;
    const columns = new Set(
      namedColumnValues(
        database,
        `PRAGMA table_info(${table.name})`,
        "name",
      ).filter((value): value is string => typeof value === "string"),
    );
    return columns.has("name") && columns.has("isDead")
      ? { ...table, columns: [...columns] }
      : undefined;
  }).filter((table): table is SupportedWebTable => Boolean(table));
  if (supported.length === 0) {
    throw new Error(
      "Esta versão de players.db não possui um schema compatível com a recuperação.",
    );
  }
  return supported;
}

function coordinateSelect(columns: string[]): string {
  return (["x", "y", "z"] as const)
    .map((column) => (columns.includes(column) ? column : `NULL AS ${column}`))
    .join(", ");
}

function listCharactersFromDatabase(
  database: Database,
  saveId: string,
): Character[] {
  assertIntegrity(database);
  return supportedTables(database).flatMap((table) => {
    const result = database.exec(
      `SELECT rowid, name, isDead, ${coordinateSelect(table.columns)} FROM ${table.name} ORDER BY rowid`,
    )[0];
    return (result?.values ?? []).map((row) => {
      const rowId = Number(row[0]);
      const name =
        typeof row[1] === "string" && row[1].trim()
          ? row[1].trim()
          : `CHARACTER_${rowId}`;
      return {
        id: `web-character_${table.name}_${rowId}`,
        saveId,
        name,
        dead: Number(row[2]) !== 0,
        source: table.source,
        position: readCharacterPosition(row[3], row[4], row[5]),
      } satisfies Character;
    });
  });
}

function parseCharacterId(characterId: string) {
  const match = /^web-character_(localPlayers|networkPlayers)_(\d+)$/.exec(
    characterId,
  );
  if (!match) throw new Error("O identificador do personagem é inválido.");
  return { table: match[1], rowId: Number(match[2]) } as const;
}

export async function scanPlayersDatabase(
  bytes: Uint8Array,
  saveId: string,
  wasmUrl: string,
): Promise<Character[]> {
  const SQL = await loadSql(wasmUrl);
  const database = new SQL.Database(bytes);
  try {
    return listCharactersFromDatabase(database, saveId);
  } finally {
    database.close();
  }
}

export async function recoverPlayersDatabase(
  bytes: Uint8Array,
  saveId: string,
  characterId: string,
  wasmUrl: string,
): Promise<{ database: Uint8Array; characters: Character[] }> {
  const SQL = await loadSql(wasmUrl);
  const database = new SQL.Database(bytes);
  const { table, rowId } = parseCharacterId(characterId);
  try {
    const supported = supportedTables(database);
    if (!supported.some((candidate) => candidate.name === table)) {
      throw new Error("A tabela do personagem não é compatível.");
    }
    database.run("BEGIN IMMEDIATE");
    try {
      const before = database.exec(
        `SELECT isDead FROM ${table} WHERE rowid = ?`,
        [rowId],
      )[0]?.values[0]?.[0];
      if (before === undefined) throw new Error("O personagem não foi encontrado.");
      if (Number(before) === 0) throw new Error("Este personagem já está vivo.");

      database.run(
        `UPDATE ${table} SET isDead = 0 WHERE rowid = ? AND isDead <> 0`,
        [rowId],
      );
      if (database.getRowsModified() !== 1) {
        throw new Error("A atualização do personagem não afetou exatamente uma linha.");
      }
      const after = database.exec(
        `SELECT isDead FROM ${table} WHERE rowid = ?`,
        [rowId],
      )[0]?.values[0]?.[0];
      if (Number(after) !== 0) {
        throw new Error("A recuperação não pôde ser validada.");
      }
      assertIntegrity(database);
      database.run("COMMIT");
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
    const characters = listCharactersFromDatabase(database, saveId);
    return { database: database.export(), characters };
  } finally {
    database.close();
  }
}
