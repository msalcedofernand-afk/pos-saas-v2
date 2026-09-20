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
