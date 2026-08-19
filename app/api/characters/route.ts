import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { listCharacters } from "@/lib/character/list-characters";
import { readConfig } from "@/lib/config/config";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveIdSchema = z.string().regex(/^save_[a-f0-9]{16}$/);

export async function GET(request: Request) {
  try {
    assertLocalRuntime();
    const saveId = saveIdSchema.parse(
      new URL(request.url).searchParams.get("saveId"),
    );
    const config = await readConfig();
    return successResponse(await listCharacters(config, saveId));
  } catch (error) {
    return errorResponse(error);
  }
}
