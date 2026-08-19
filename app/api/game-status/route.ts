import { errorResponse, successResponse } from "@/lib/api/response";
import { getCachedProjectZomboidRunning } from "@/lib/zomboid/process";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertLocalRuntime();
    return successResponse({ running: await getCachedProjectZomboidRunning() });
  } catch (error) {
    return errorResponse(error);
  }
}
