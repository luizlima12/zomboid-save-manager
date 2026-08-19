import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { synchronizeRecoveryStatus } from "@/lib/recovery/recovery-status";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recoveryIdSchema = z.string().regex(/^recovery_[a-f0-9-]{36}$/);

export async function GET(
  _request: Request,
  context: { params: Promise<{ recoveryId: string }> },
) {
  try {
    assertLocalRuntime();
    const { recoveryId } = await context.params;
    return successResponse(
      await synchronizeRecoveryStatus(recoveryIdSchema.parse(recoveryId)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
