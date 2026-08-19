import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { readConfig } from "@/lib/config/config";
import { rollbackRecovery } from "@/lib/recovery/rollback-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recoveryIdSchema = z.string().regex(/^recovery_[a-f0-9-]{36}$/);

export async function POST(
  _request: Request,
  context: { params: Promise<{ recoveryId: string }> },
) {
  try {
    const { recoveryId } = await context.params;
    const config = await readConfig();
    return successResponse(
      await rollbackRecovery(recoveryIdSchema.parse(recoveryId), { config }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
