/// <reference lib="webworker" />

import {
  recoverPlayersDatabase,
  scanPlayersDatabase,
} from "@/lib/web/sqlite-engine";
import type {
  SaveWorkerRequest,
  SaveWorkerResponse,
} from "@/lib/web/types";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<SaveWorkerRequest>) => {
  const request = event.data;
  try {
    const bytes = new Uint8Array(request.database);
    const wasmUrl = new URL("/sql-wasm.wasm", workerScope.location.origin).toString();
    if (request.action === "scan") {
      const characters = await scanPlayersDatabase(bytes, request.saveId, wasmUrl);
      workerScope.postMessage({
        requestId: request.requestId,
        success: true,
        characters,
      } satisfies SaveWorkerResponse);
      return;
    }

    if (!request.characterId) throw new Error("Selecione um personagem.");
    const result = await recoverPlayersDatabase(
      bytes,
      request.saveId,
      request.characterId,
      wasmUrl,
    );
    const database = result.database.buffer.slice(
      result.database.byteOffset,
      result.database.byteOffset + result.database.byteLength,
    ) as ArrayBuffer;
    workerScope.postMessage(
      {
        requestId: request.requestId,
        success: true,
        characters: result.characters,
        database,
      } satisfies SaveWorkerResponse,
      [database],
    );
  } catch (error) {
    workerScope.postMessage({
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : "Falha ao processar players.db.",
    } satisfies SaveWorkerResponse);
  }
};
