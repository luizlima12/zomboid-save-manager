import path from "node:path";

import { AppError } from "@/lib/errors";

function normalizeForComparison(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isPathInside(parent: string, child: string): boolean {
  const normalizedParent = normalizeForComparison(parent);
  const normalizedChild = normalizeForComparison(child);
  const relative = path.relative(normalizedParent, normalizedChild);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export function assertPathInside(parent: string, child: string): void {
  if (!isPathInside(parent, child)) {
    throw new AppError(
      "UNSAFE_PATH",
      "A operação foi cancelada porque o caminho solicitado não é seguro.",
      400,
    );
  }
}
