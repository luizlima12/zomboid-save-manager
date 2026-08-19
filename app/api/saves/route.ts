import { errorResponse, successResponse } from "@/lib/api/response";
import { readConfig } from "@/lib/config/config";
import { listSaves } from "@/lib/saves/list-saves";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertLocalRuntime();
    const config = await readConfig();
    return successResponse(await listSaves(config));
  } catch (error) {
    return errorResponse(error);
  }
}
