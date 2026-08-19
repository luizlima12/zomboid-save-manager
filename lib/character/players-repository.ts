import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { AppError } from "@/lib/errors";
import { readCharacterPosition } from "@/lib/character/character-position";
import type {
  CharacterRecord,
  PlayersTableSchema,
  SupportedPlayersTable,
} from "@/lib/character/types";

interface TableNameRow {
  name: string;
}

interface TableInfoRow {
  name: string;
}

interface CharacterRow {
  rowId: number;
  name: unknown;
  isDead: unknown;
  x: unknown;
  y: unknown;
  z: unknown;
}

const TABLE_CANDIDATES: ReadonlyArray<Omit<PlayersTableSchema, "columns">> = [
  { table: "localPlayers", source: "local" },
  { table: "networkPlayers", source: "hosted" },
];

function createCharacterId(
  saveId: string,
  table: SupportedPlayersTable,
  rowId: number,
): string {
  const digest = createHash("sha256")
    .update(`${saveId}:${table}:${rowId}`)
    .digest("hex")
    .slice(0, 18);
  return `character_${digest}`;
}

export class PlayersRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath: string, readonly: boolean) {
    this.database = new DatabaseSync(databasePath, {
      readOnly: readonly,
      timeout: 5_000,
      enableForeignKeyConstraints: false,
    });
    this.database.exec("PRAGMA busy_timeout = 5000");
  }

  close(): void {
    this.database.close();
  }

  validateIntegrity(): void {
    const rows = this.database
      .prepare("PRAGMA integrity_check")
      .all() as Array<Record<string, unknown>>;
    const values = rows.flatMap((row) => Object.values(row));
    if (values.length !== 1 || values[0] !== "ok") {
      throw new AppError(
        "PLAYERS_DB_INTEGRITY_FAILED",
        "players.db apresenta problemas de integridade. A recuperação foi cancelada.",
        422,
      );
    }
  }

  getSupportedSchemas(): PlayersTableSchema[] {
    const existingTables = new Set(
      (
        this.database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as unknown as TableNameRow[]
      ).map((row) => row.name),
    );

    const schemas = TABLE_CANDIDATES.map((candidate) => {
      if (!existingTables.has(candidate.table)) return false;
      const columns = new Set(
        (
          this.database
            .prepare(`PRAGMA table_info(${candidate.table})`)
            .all() as unknown as TableInfoRow[]
        ).map((row) => row.name),
      );
      return columns.has("name") && columns.has("isDead")
        ? { ...candidate, columns: [...columns] }
        : undefined;
    }).filter((schema): schema is PlayersTableSchema => Boolean(schema));

    if (schemas.length === 0) {
      throw new AppError(
        "PLAYERS_DB_SCHEMA_UNSUPPORTED",
        "Esta versão do save não é compatível com o Character Recovery atual.",
        422,
      );
    }
    return schemas;
  }

  listCharacters(saveId: string): CharacterRecord[] {
    this.validateIntegrity();
    return this.getSupportedSchemas().flatMap((schema) =>
      this.readCharactersFromTable(saveId, schema),
    );
  }

  findCharacter(saveId: string, characterId: string): CharacterRecord | undefined {
    return this.listCharacters(saveId).find(
      (character) => character.id === characterId,
    );
  }

  reviveCharacter(character: CharacterRecord): void {
    const table = character.table;
    if (!TABLE_CANDIDATES.some((candidate) => candidate.table === table)) {
      throw new AppError(
        "PLAYERS_DB_SCHEMA_UNSUPPORTED",
        "O schema do personagem não é compatível.",
        422,
      );
    }

    const readStatement = this.database.prepare(
      `SELECT isDead FROM ${table} WHERE rowid = ?`,
    );
    const updateStatement = this.database.prepare(
      `UPDATE ${table} SET isDead = 0 WHERE rowid = ? AND isDead <> 0`,
    );

    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.validateIntegrity();
      const before = readStatement.get(character.rowId) as
        | { isDead: unknown }
        | undefined;
      if (!before) {
        throw new AppError(
          "CHARACTER_NOT_FOUND",
          "O personagem não existe mais no banco de dados.",
          404,
        );
      }
      if (!Boolean(before.isDead)) {
        throw new AppError(
          "CHARACTER_ALREADY_ALIVE",
          "Este personagem já está vivo.",
          409,
        );
      }

      const result = updateStatement.run(character.rowId);
      const after = readStatement.get(character.rowId) as
        | { isDead: unknown }
        | undefined;
      if (result.changes !== 1 || !after || Boolean(after.isDead)) {
        throw new AppError(
          "CHARACTER_REVIVE_VALIDATION_FAILED",
          "A alteração do personagem não pôde ser validada e foi revertida.",
          500,
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      if (this.database.isTransaction) this.database.exec("ROLLBACK");
      throw error;
    }
    this.validateIntegrity();
  }

  private readCharactersFromTable(
    saveId: string,
    schema: PlayersTableSchema,
  ): CharacterRecord[] {
    const rows = this.database
      .prepare(
        `SELECT rowid AS rowId, name, isDead, ${this.coordinateSelect(schema)} FROM ${schema.table} ORDER BY rowid`,
      )
      .all() as unknown as CharacterRow[];

    return rows.map((row) => ({
      id: createCharacterId(saveId, schema.table, row.rowId),
      saveId,
      name:
        typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : `CHARACTER_${row.rowId}`,
      dead: Boolean(row.isDead),
      source: schema.source,
      position: readCharacterPosition(row.x, row.y, row.z),
      table: schema.table,
      rowId: row.rowId,
    }));
  }

  private coordinateSelect(schema: PlayersTableSchema): string {
    return (["x", "y", "z"] as const)
      .map((column) =>
        schema.columns.includes(column) ? column : `NULL AS ${column}`,
      )
      .join(", ");
  }
}
