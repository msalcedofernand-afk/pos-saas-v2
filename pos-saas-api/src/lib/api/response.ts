import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR", message, details } },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("Datos inválidos", 400, error.issues);
  }

  console.error("Unhandled API error:", error);
  return apiError("Error interno del servidor", 500);
}

export function rpcApiError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("no encontrado")) return apiError("Recurso no encontrado", 404);
  if (
    message.includes("inválid") ||
    message.includes("invalida") ||
    message.includes("no se puede") ||
    message.includes("solo se puede") ||
    message.includes("debes") ||
    message.includes("debe indicar") ||
    message.includes("no está disponible") ||
    message.includes("no esta disponible") ||
    message.includes("ya está") ||
    message.includes("ya esta")
  ) {
    return apiError(fallback, 409);
  }
  console.error("Database operation failed:", error);
  return apiError("No se pudo completar la operación", 500);
}
