import {
  BlobReader,
  BlobWriter,
  type Entry,
  ZipReader,
} from "@zip.js/zip.js";

import type {
  BrowserSaveEntry,
  BrowserSaveWorkspace,
} from "@/lib/web/types";

interface BrowserFileSystemFileHandle {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
}

export interface BrowserFileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  entries: () => AsyncIterableIterator<
    [
      string,
      BrowserFileSystemFileHandle | BrowserFileSystemDirectoryHandle,
    ]
  >;
}

function assertSafePath(value: string): string {
  const path = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[a-zA-Z]:/.test(path) ||
    path.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error(`O caminho “${value}” não é seguro para importação.`);
  }
  return path;
}

function stripRoot(path: string, root: string): string {
  if (!root) return path;
  const prefix = `${root}/`;
  if (!path.startsWith(prefix)) {
    throw new Error("O arquivo está fora da pasta raiz do save selecionado.");
  }
  return path.slice(prefix.length);
}

async function sha256Short(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createWorkspace(
  rawEntries: BrowserSaveEntry[],
  hintedName: string,
  sourceType: BrowserSaveWorkspace["sourceType"],
  cleanup: () => Promise<void>,
): Promise<BrowserSaveWorkspace> {
  const normalized = rawEntries.map((entry) => ({
    ...entry,
    path: assertSafePath(entry.path),
  }));
  const databaseCandidates = normalized.filter(
    (entry) => entry.path.toLowerCase() === "players.db" ||
      entry.path.toLowerCase().endsWith("/players.db"),
  );
  if (databaseCandidates.length === 0) {
    throw new Error(
      "players.db não foi encontrado. Selecione a pasta individual do save, não a pasta geral Saves.",
    );
  }
  if (databaseCandidates.length > 1) {
    throw new Error(
      "Mais de um save foi encontrado. Selecione apenas uma pasta de partida.",
    );
  }

  const originalDatabasePath = databaseCandidates[0].path;
  const root = originalDatabasePath.includes("/")
    ? originalDatabasePath.slice(0, originalDatabasePath.lastIndexOf("/"))
    : "";
  const entries = normalized.map((entry) => ({
    ...entry,
    path: stripRoot(entry.path, root),
  }));
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new Error(`Arquivo duplicado no save: ${entry.path}`);
    seen.add(key);
  }

  const playersDbPath = entries.find(
    (entry) => entry.path.toLowerCase() === "players.db",
  )?.path;
  const mapVersionPath = entries.find(
    (entry) => entry.path.toLowerCase() === "map_ver.bin",
  )?.path;
  if (!playersDbPath || !mapVersionPath) {
    throw new Error(
      "A pasta não parece ser um save completo: players.db e map_ver.bin são obrigatórios.",
    );
  }

  const rootName = root.split("/").filter(Boolean).at(-1);
  const name = (rootName || hintedName || "IMPORTED_SAVE").replace(
    /[^a-zA-Z0-9_-]+/g,
    "_",
  );
  const playersEntry = entries.find((entry) => entry.path === playersDbPath)!;
  const originalPlayersDb = new Uint8Array(
    await (await playersEntry.getBlob()).arrayBuffer(),
  );
  const size = entries.reduce((total, entry) => total + entry.size, 0);
  const id = `web-save_${await sha256Short(`${name}:${size}:${entries.length}`)}`;

  return {
    id,
    name,
    gameMode: "Imported",
    sourceType,
    importedAt: new Date().toISOString(),
    entries,
    playersDbPath,
    mapVersionPath,
    originalPlayersDb,
    characters: [],
    size,
    cleanup,
  };
}

async function walkDirectory(
  handle: BrowserFileSystemDirectoryHandle,
  prefix = "",
): Promise<BrowserSaveEntry[]> {
  const entries: BrowserSaveEntry[] = [];
  for await (const [name, child] of handle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (child.kind === "directory") {
      entries.push(...(await walkDirectory(child, path)));
      continue;
    }
    const file = await child.getFile();
    entries.push({
      path,
      size: file.size,
      lastModified: file.lastModified,
      getBlob: async () => file,
    });
  }
  return entries;
}

export async function importDirectoryHandle(
  handle: BrowserFileSystemDirectoryHandle,
): Promise<BrowserSaveWorkspace> {
  const entries = await walkDirectory(handle);
  return createWorkspace(entries, handle.name, "directory", async () => undefined);
}

export async function importDirectoryFiles(
  files: FileList | File[],
): Promise<BrowserSaveWorkspace> {
  const list = Array.from(files);
  if (list.length === 0) throw new Error("Nenhuma pasta foi selecionada.");
  const entries = list.map((file) => ({
    path: file.webkitRelativePath || file.name,
    size: file.size,
    lastModified: file.lastModified,
    getBlob: async () => file,
  }));
  const hintedName =
    (list[0].webkitRelativePath || "").split("/")[0] || "IMPORTED_SAVE";
  return createWorkspace(
    entries,
    hintedName,
    "directory-input",
    async () => undefined,
  );
}

export async function importZipFile(file: File): Promise<BrowserSaveWorkspace> {
  const reader = new ZipReader(new BlobReader(file), {
    filenameValidation: "strict",
  });
  let zipEntries: Entry[];
  try {
    zipEntries = await reader.getEntries({ filenameValidation: "strict" });
  } finally {
    await reader.close();
  }

  const files = zipEntries
    .filter((entry) => !entry.directory)
    .map((entry): BrowserSaveEntry => ({
      path: entry.filename,
      size: entry.uncompressedSize,
      lastModified: entry.lastModDate?.getTime() ?? Date.now(),
      getBlob: async () => {
        if (!entry.getData) throw new Error(`Não foi possível ler ${entry.filename}.`);
        return entry.getData(new BlobWriter());
      },
    }));
  return createWorkspace(
    files,
    file.name.replace(/\.zip$/i, ""),
    "zip",
    async () => undefined,
  );
}
