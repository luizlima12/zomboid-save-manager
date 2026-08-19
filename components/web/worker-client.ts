import type {
  SaveWorkerRequest,
  SaveWorkerResponse,
} from "@/lib/web/types";

export async function runSaveWorker(
  request: Omit<SaveWorkerRequest, "requestId">,
): Promise<SaveWorkerResponse & { success: true }> {
  const worker = new Worker(new URL("./save-worker.ts", import.meta.url), {
    type: "module",
  });
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("O processamento demorou mais que o esperado."));
    }, 120_000);

    worker.onmessage = (event: MessageEvent<SaveWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;
      window.clearTimeout(timeout);
      worker.terminate();
      if (!event.data.success) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error("O worker de processamento não pôde ser iniciado."));
    };

    worker.postMessage({ ...request, requestId } satisfies SaveWorkerRequest);
  });
}
