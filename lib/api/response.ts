import { NextResponse } from "next/server";

import { toPublicError } from "@/lib/errors";
import type { ApiResponse } from "@/lib/types";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, data },
    { status },
  );
}

export function errorResponse(error: unknown) {
  const publicError = toPublicError(error);
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: { code: publicError.code, message: publicError.message },
    },
    { status: publicError.status },
  );
}
