import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export function getIdempotencyKey(request: NextRequest): string | null {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim() ?? "";
  if (!key || key.length > 128) return null;
  return key;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export function parseIdempotentResult<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}
