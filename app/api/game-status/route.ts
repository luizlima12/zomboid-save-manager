import { errorResponse, successResponse } from "@/lib/api/response";
import { getCachedProjectZomboidRunning } from "@/lib/zomboid/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return successResponse({ running: await getCachedProjectZomboidRunning() });
  } catch (error) {
    return errorResponse(error);
  }
}
