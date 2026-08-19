import { AppError } from "@/lib/errors";
import type { RuntimeMode } from "@/lib/types";

export interface RuntimeEnvironment {
  ZSM_RUNTIME_MODE?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
}

export function resolveRuntimeMode(
  environment?: RuntimeEnvironment,
): RuntimeMode {
  const runtimeEnvironment = environment ?? {
    ZSM_RUNTIME_MODE: process.env.ZSM_RUNTIME_MODE,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  };
  if (runtimeEnvironment.ZSM_RUNTIME_MODE === "web") return "web";
  if (runtimeEnvironment.ZSM_RUNTIME_MODE === "local") return "local";
  if (
    runtimeEnvironment.VERCEL === "1" ||
    Boolean(runtimeEnvironment.VERCEL_ENV) ||
    Boolean(runtimeEnvironment.VERCEL_URL)
  ) {
    return "web";
  }
  return "local";
}

export function assertLocalRuntime(
  environment?: RuntimeEnvironment,
): void {
  if (resolveRuntimeMode(environment) === "web") {
    throw new AppError(
      "LOCAL_RUNTIME_REQUIRED",
      "Esta operação exige o aplicativo local. Na versão web, selecione ou importe um save no navegador.",
      409,
    );
  }
}
