import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

type PlansClient = {
  from: (table: "plans") => {
    select: (columns: string) => {
      eq: (
        column: "is_active",
        value: boolean,
      ) => {
        order: (
          column: "monthly_price",
          options: { ascending: boolean; nullsFirst: boolean },
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["platform_admin"]);
    if (auth.response) return auth.response;

    const { data, error } = await (createAdminClient() as unknown as PlansClient)
      .from("plans")
      .select(
        "id, code, name, description, monthly_price, currency, max_users, max_branches, max_products, max_monthly_orders, max_storage_bytes, features, is_active",
      )
      .eq("is_active", true)
      .order("monthly_price", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
