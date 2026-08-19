import { access } from "node:fs/promises";
import path from "node:path";

import { PlayersRepository } from "@/lib/character/players-repository";
import { AppError } from "@/lib/errors";
import { assertPathInside } from "@/lib/security/safe-path";
import { resolveSaveById } from "@/lib/saves/list-saves";
import type { AppConfig, CharacterScan } from "@/lib/types";

export async function resolvePlayersDbPath(
  config: AppConfig,
  saveId: string,
): Promise<{ databasePath: string; saveName: string; gameMode: string }> {
  const save = await resolveSaveById(config, saveId);
  if (!save) {
    throw new AppError(
      "SAVE_NOT_FOUND",
      "Este save não foi encontrado. Atualize a lista e tente novamente.",
      404,
    );
  }

  const databasePath = path.join(save.path, "players.db");
  assertPathInside(save.path, databasePath);
  try {
    await access(databasePath);
  } catch {
    throw new AppError(
      "PLAYERS_DB_NOT_FOUND",
      "Este save não possui players.db e não pode ser recuperado automaticamente.",
      404,
    );
  }
  return { databasePath, saveName: save.name, gameMode: save.gameMode };
}

export async function listCharacters(
  config: AppConfig,
  saveId: string,
): Promise<CharacterScan> {
  const resolved = await resolvePlayersDbPath(config, saveId);
  let repository: PlayersRepository | undefined;
  try {
    repository = new PlayersRepository(resolved.databasePath, true);
    const characters = repository.listCharacters(saveId).map((character) => ({
      id: character.id,
      saveId: character.saveId,
      name: character.name,
      dead: character.dead,
      source: character.source,
      position: character.position,
    }));
    return {
      saveId,
      saveName: resolved.saveName,
      gameMode: resolved.gameMode,
      compatible: true,
      characters,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PLAYERS_DB_INVALID",
      "Não foi possível ler players.db. O arquivo pode estar inválido ou em uso.",
      422,
      { cause: error },
    );
  } finally {
    repository?.close();
  }
}
