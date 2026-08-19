import { z } from "zod";

import { errorResponse, successResponse } from "@/lib/api/response";
import { createBackup } from "@/lib/backup/create-backup";
import { listBackups } from "@/lib/backup/list-backups";
import { readConfig } from "@/lib/config/config";
import { assertLocalRuntime } from "@/lib/runtime/runtime-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBackupSchema = z.object({
  saveId: z.string().regex(/^save_[a-f0-9]{16}$/),
  label: z.string().trim().max(80).optional(),
});

export async function GET(request: Request) {
  try {
    assertLocalRuntime();
    const saveId = new URL(request.url).searchParams.get("saveId") ?? undefined;
    return successResponse(await listBackups(saveId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRuntime();
    const input = createBackupSchema.parse(await request.json());
    const config = await readConfig();
    const backup = await createBackup(
      input.saveId,
      { label: input.label, type: "manual" },
      { config },
    );
    return successResponse(backup, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
