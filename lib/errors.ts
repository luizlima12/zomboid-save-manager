import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export function toPublicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      "INVALID_REQUEST",
      "Os dados enviados não são válidos. Revise os campos e tente novamente.",
      400,
      { cause: error },
    );
  }

  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "EACCES" || code === "EPERM") {
    return new AppError(
      "FILESYSTEM_PERMISSION_DENIED",
      "O Windows bloqueou o acesso à pasta. Verifique as permissões e tente novamente.",
      403,
      { cause: error },
    );
  }

  console.error("Unexpected Zomboid Save Manager error", error);
  return new AppError(
    "FILESYSTEM_UNAVAILABLE",
    "Não foi possível acessar os arquivos do save. Verifique as configurações e tente novamente.",
    500,
    { cause: error },
  );
}
