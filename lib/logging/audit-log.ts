import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { getAppDirectories } from "@/lib/config/config";
import { assertPathInside } from "@/lib/security/safe-path";

export async function writeAuditLog(
  event: string,
  details: Record<string, string> = {},
): Promise<void> {
  const { logs } = getAppDirectories();
  const date = new Date().toISOString().slice(0, 10);
  const logPath = path.join(logs, `${date}.log`);
  assertPathInside(logs, logPath);
  await mkdir(logs, { recursive: true });

  const safeDetails = Object.entries(details)
    .map(([key, value]) => `${key}=${value.replaceAll(/[\r\n]/g, " ")}`)
    .join(" ");
  await appendFile(
    logPath,
    `${new Date().toISOString()} ${event}${safeDetails ? ` ${safeDetails}` : ""}\n`,
    "utf8",
  );
}
