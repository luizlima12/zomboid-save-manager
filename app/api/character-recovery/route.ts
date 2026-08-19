import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { readConfig } from "@/lib/config/config";
import { recoverCharacter } from "@/lib/recovery/recover-character";
import { listRecoveryHistory } from "@/lib/recovery/recovery-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recoverySchema = z.object({
  saveId: z.string().regex(/^save_[a-f0-9]{16}$/),
  characterId: z.string().regex(/^character_[a-f0-9]{18}$/),
  mode: z.enum(["revive", "full-health"]),
});

export async function GET(request: Request) {
  try {
    const saveId = new URL(request.url).searchParams.get("saveId");
    const history = await listRecoveryHistory();
    return successResponse(
      saveId
        ? history.filter((recovery) => recovery.saveId === saveId)
        : history,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = recoverySchema.parse(await request.json());
    const config = await readConfig();
    return successResponse(
      await recoverCharacter(input, { config }),
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
