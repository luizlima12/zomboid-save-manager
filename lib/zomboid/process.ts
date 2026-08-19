import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const processStatusState = globalThis as typeof globalThis & {
  __zsmProcessStatus?: {
    checkedAt: number;
    running: boolean;
    pending?: Promise<boolean>;
  };
};

const ZOMBOID_PROCESS_NAMES = new Set([
  "projectzomboid.exe",
  "projectzomboid32.exe",
  "projectzomboid64.exe",
  "projectzomboidserver.exe",
  "projectzomboidserver64.exe",
]);

export function parseWindowsTaskList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quotedName = /^"([^"]+)"/.exec(line)?.[1];
      return (quotedName ?? line.split(",")[0] ?? "").replaceAll('"', "");
    });
}

export async function isProjectZomboidRunning(): Promise<boolean> {
  if (process.platform !== "win32") return false;

  const { stdout } = await execFileAsync(
    "tasklist.exe",
    ["/FO", "CSV", "/NH"],
    { windowsHide: true, timeout: 10_000, maxBuffer: 4 * 1024 * 1024 },
  );

  return parseWindowsTaskList(stdout).some((processName) =>
    ZOMBOID_PROCESS_NAMES.has(processName.toLowerCase()),
  );
}

export async function getCachedProjectZomboidRunning(
  maxAgeMs = 2_000,
): Promise<boolean> {
  const now = Date.now();
  const state = processStatusState.__zsmProcessStatus;
  if (state && now - state.checkedAt < maxAgeMs) return state.running;
  if (state?.pending) return state.pending;

  const pending = isProjectZomboidRunning().then(
    (running) => {
      processStatusState.__zsmProcessStatus = {
        checkedAt: Date.now(),
        running,
      };
      return running;
    },
    (error: unknown) => {
      delete processStatusState.__zsmProcessStatus;
      throw error;
    },
  );
  processStatusState.__zsmProcessStatus = {
    checkedAt: state?.checkedAt ?? 0,
    running: state?.running ?? false,
    pending,
  };
  return pending;
}
