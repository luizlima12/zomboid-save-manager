import { errorResponse, successResponse } from "@/lib/api/response";
import { readConfig, writeConfig } from "@/lib/config/config";
import { appConfigUpdateSchema } from "@/lib/config/schema";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertLocalRuntime();
    return successResponse(await readConfig());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertLocalRuntime();
    const updates = appConfigUpdateSchema.parse(await request.json());
    const current = await readConfig();
    return successResponse(await writeConfig({ ...current, ...updates }));
  } catch (error) {
    return errorResponse(error);
  }
}
