import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertPathInside } from "@/lib/security/safe-path";

const atomicWriteState = globalThis as typeof globalThis & {
  __zsmAtomicWriteQueue?: Promise<void>;
};

export async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw error;
  }
}

export function writeJsonAtomic<T>(
  filePath: string,
  value: T,
): Promise<void> {
  const writeOperation = async () => {
    const parent = path.dirname(filePath);
    const tempPath = path.join(
      parent,
      `.${path.basename(filePath)}.${randomUUID()}.tmp`,
    );
    assertPathInside(parent, tempPath);

    await mkdir(parent, { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: "utf8",
        flag: "w",
      });
      await rename(tempPath, filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  };

  const previousWrite =
    atomicWriteState.__zsmAtomicWriteQueue ?? Promise.resolve();
  const result = previousWrite.then(writeOperation, writeOperation);
  atomicWriteState.__zsmAtomicWriteQueue = result.catch(() => undefined);
  return result;
}
