import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const version = process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await createAdminClient().from("organizations").select("id", { head: true, count: "exact" });
    if (error) throw error;
    return NextResponse.json({ status: "ready", version, dependencies: { supabase: "ok" } });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json(
      { status: "not_ready", version, dependencies: { supabase: "unavailable" } },
      { status: 503 },
    );
  }
}
