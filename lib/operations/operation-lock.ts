import { AppError } from "@/lib/errors";
import type { Operation } from "@/lib/types";

let activeOperation: Operation = null;

export async function withOperationLock<T>(
  operation: Exclude<Operation, null>,
  action: () => Promise<T>,
): Promise<T> {
  if (activeOperation) {
    throw new AppError(
      "OPERATION_IN_PROGRESS",
      `A operação ${activeOperation} ainda está em andamento. Aguarde a conclusão.`,
      409,
    );
  }

  activeOperation = operation;
  try {
    return await action();
  } finally {
    activeOperation = null;
  }
}
