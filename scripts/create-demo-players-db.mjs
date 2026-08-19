import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const fixtureRoot = path.resolve("fixtures", "demo-user");
const databasePath = path.resolve(
  fixtureRoot,
  "Zomboid",
  "Saves",
  "Sandbox",
  "FELIPE_GAME",
  "players.db",
);

if (!databasePath.startsWith(`${fixtureRoot}${path.sep}`)) {
  throw new Error("Refusing to create a database outside the demo fixture.");
}

await mkdir(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
try {
  database.exec(`
    DROP TABLE IF EXISTS localPlayers;
    CREATE TABLE localPlayers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      isDead INTEGER NOT NULL,
      x REAL,
      y REAL,
      z REAL,
      data BLOB
    );
    INSERT INTO localPlayers (name, isDead, x, y, z, data)
    VALUES
      ('Luiz Felipe', 1, 10635, 9954, 0, X'010203'),
      ('Mara Voss', 0, 11822.5, 6892, 1, X'040506');
  `);
} finally {
  database.close();
}

process.stdout.write(`${databasePath}\n`);
