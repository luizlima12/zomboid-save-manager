import type { Character } from "@/lib/types";

export type SupportedPlayersTable = "localPlayers" | "networkPlayers";

export interface CharacterRecord extends Character {
  table: SupportedPlayersTable;
  rowId: number;
}

export interface PlayersTableSchema {
  table: SupportedPlayersTable;
  source: Character["source"];
}
