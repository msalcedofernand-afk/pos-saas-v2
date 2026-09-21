import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const version = process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "v1";
const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function describeAdminKeyFormat() {
  if (!adminKey) return "missing";
  if (adminKey.startsWith("sb_secret_")) return "modern_secret";
  if (adminKey.startsWith("eyJ")) return "legacy_jwt";
  return "unknown";
}

export const dynamic = "force-dynamic";

function describeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      status?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return {
      name: candidate.name,
      message: candidate.message,
      code: candidate.code,
      status: candidate.status,
      details: candidate.details,
      hint: candidate.hint,
    };
  }

  return { valueType: typeof error };
}

export async function GET() {
  try {
    const { error } = await createAdminClient().from("organizations").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ status: "ready", version, dependencies: { supabase: "ok" } });
  } catch (error) {
    console.error("Readiness check failed:", {
      configuration: {
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAdminKey: Boolean(adminKey),
        adminKeyFormat: describeAdminKeyFormat(),
        adminKeySource: process.env.SUPABASE_SECRET_KEY
          ? "SUPABASE_SECRET_KEY"
          : process.env.SUPABASE_SERVICE_ROLE_KEY
            ? "SUPABASE_SERVICE_ROLE_KEY"
            : "missing",
      },
      error: describeError(error),
    });
    return NextResponse.json(
      { status: "not_ready", version, dependencies: { supabase: "unavailable" } },
      { status: 503 },
    );
  }
}
