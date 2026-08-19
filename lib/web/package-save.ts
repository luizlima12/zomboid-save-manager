import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

import {
  buildRecoveryLua,
  RECOVERY_MOD_INFO,
} from "@/lib/recovery/recovery-lua";
import type { RecoveryMode } from "@/lib/types";
import type {
  BrowserSaveWorkspace,
  RecoveryPackageManifest,
  WebOperationProgress,
} from "@/lib/web/types";

interface WritableFileHandle {
  createWritable: () => Promise<WritableStream>;
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<WritableFileHandle>;
}

export interface PackageOutputTarget {
  filename: string;
  writable?: WritableStream;
}

export async function selectPackageOutput(
  filename: string,
): Promise<PackageOutputTarget> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) return { filename };
  const handle = await picker({
    suggestedName: filename,
    types: [
      {
        description: "Arquivo ZIP",
        accept: { "application/zip": [".zip"] },
      },
    ],
  });
  return { filename, writable: await handle.createWritable() };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function recoveryReadme(
  workspace: BrowserSaveWorkspace,
  mode: "backup" | RecoveryMode,
): string {
  const modSteps =
    mode === "full-health"
      ? `\n2. Copie a pasta mod/ZomboidSaveManagerRecovery para:\n   C:\\Users\\SEU_USUARIO\\Zomboid\\mods\\\n3. Habilite “Zomboid Save Manager Recovery” no menu Mods.\n4. Carregue ${workspace.name}. O mod executa uma única vez.\n`
      : "\n2. Inicie o jogo e carregue a cópia recuperada.\n";
  return `ZOMBOID SAVE MANAGER — PACOTE PRIVADO\n\nEste pacote foi processado integralmente no navegador.\nO save original não foi alterado nem enviado para um servidor.\n\nINSTALAÇÃO\n1. Extraia save/${workspace.name} para a pasta do modo correspondente em Zomboid/Saves.${modSteps}\nAntes de substituir qualquer arquivo, mantenha seu save original preservado.\n`;
}

export async function generateSavePackage(options: {
  workspace: BrowserSaveWorkspace;
  target: PackageOutputTarget;
  mode: "backup" | RecoveryMode;
  characterName?: string;
  recoveredPlayersDb?: Uint8Array;
  onProgress: (progress: WebOperationProgress) => void;
}): Promise<{ blob?: Blob; manifest: RecoveryPackageManifest }> {
  const {
    workspace,
    target,
    mode,
    characterName,
    recoveredPlayersDb,
    onProgress,
  } = options;
  onProgress({ stage: "hashing", percent: 5, message: "Calculando integridade..." });
  const originalHash = await sha256Hex(workspace.originalPlayersDb);
  const outputDatabase = recoveredPlayersDb ?? workspace.originalPlayersDb;
  const recoveredHash = await sha256Hex(outputDatabase);
  const createdAt = new Date().toISOString();
  const manifest: RecoveryPackageManifest = {
    formatVersion: 1,
    generatedBy: "Zomboid Save Manager Web",
    saveName: workspace.name,
    characterName,
    mode,
    createdAt,
    originalPlayersDbSha256: originalHash,
    outputPlayersDbSha256: recoveredHash,
    originalUntouched: true,
    files: workspace.entries.map((entry) => ({
      path: entry.path,
      size: entry.path === workspace.playersDbPath ? outputDatabase.byteLength : entry.size,
    })),
  };

  const blobWriter = target.writable ? undefined : new BlobWriter("application/zip");
  const zipWriter = new ZipWriter(target.writable ?? blobWriter!, {
    zip64: true,
    bufferedWrite: true,
  });
  try {
    for (let index = 0; index < workspace.entries.length; index += 1) {
      const entry = workspace.entries[index];
      const blob =
        entry.path === workspace.playersDbPath
          ? new Blob([outputDatabase as BlobPart])
          : await entry.getBlob();
      await zipWriter.add(
        `save/${workspace.name}/${entry.path}`,
        new BlobReader(blob),
        { lastModDate: new Date(entry.lastModified), level: 6 },
      );
      onProgress({
        stage: "packing",
        percent: 10 + Math.round(((index + 1) / workspace.entries.length) * 75),
        message: `Compactando ${index + 1}/${workspace.entries.length}...`,
      });
    }

    if (mode === "full-health" && characterName) {
      const recoveryId = `web-recovery-${crypto.randomUUID()}`;
      const lua = buildRecoveryLua(
        { id: recoveryId, characterName },
        workspace.name,
      );
      const modRoot = "mod/ZomboidSaveManagerRecovery";
      for (const versionRoot of [modRoot, `${modRoot}/42`]) {
        await zipWriter.add(`${versionRoot}/mod.info`, new TextReader(RECOVERY_MOD_INFO));
        await zipWriter.add(
          `${versionRoot}/media/lua/client/ZSMRecovery.lua`,
          new TextReader(lua),
        );
      }
    }
    await zipWriter.add("README_RECOVERY.txt", new TextReader(recoveryReadme(workspace, mode)));
    await zipWriter.add(
      "manifest.json",
      new TextReader(`${JSON.stringify(manifest, null, 2)}\n`),
    );
    onProgress({ stage: "saving", percent: 95, message: "Finalizando pacote..." });
    await zipWriter.close();
  } catch (error) {
    await zipWriter.close().catch(() => undefined);
    throw error;
  }

  return { blob: blobWriter ? await blobWriter.getData() : undefined, manifest };
}

export function downloadPackageBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function packageFilename(saveName: string, suffix: string): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `ZSM_${saveName}_${suffix}_${timestamp}.zip`;
}
