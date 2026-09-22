import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";
import { businessDate, businessDayRange } from "@/lib/date/business-date";
import { createAdminClient } from "@/lib/supabase/admin";

type DashboardMetricValues = {
  sales: number;
  paidOrders: number;
  activeOrders: number;
  kitchenOrders: number;
  cashOpen: boolean;
  lowStock: number;
  productCount: number;
  categoryCount: number;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request, ["admin", "cashier", "waiter", "kitchen", "staff"], {
      requireOrganization: true,
    });
    if (auth.response) return auth.response;
    const { start, end } = businessDayRange(businessDate());
    const { data, error } = await createAdminClient().rpc("get_dashboard_metrics", {
      p_organization_id: auth.user.organizationId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });
    if (error) throw error;

    const values = (data ?? {}) as unknown as DashboardMetricValues;
    const roles = auth.user.roles;
    const canCatalog = roles.some((role) => ["admin", "cashier", "staff"].includes(role));
    const canKitchen = roles.some((role) => ["admin", "kitchen", "staff"].includes(role));
    const canCash = roles.some((role) => ["admin", "cashier"].includes(role));
    const canOrders = roles.some((role) => ["admin", "cashier", "waiter", "kitchen", "staff"].includes(role));

    return NextResponse.json({
      data: {
        sales: canCash ? Number(values.sales ?? 0) : null,
        paidOrders: canCash ? Number(values.paidOrders ?? 0) : null,
        activeOrders: canOrders ? Number(values.activeOrders ?? 0) : null,
        kitchenOrders: canKitchen ? Number(values.kitchenOrders ?? 0) : null,
        cashOpen: canCash ? Boolean(values.cashOpen) : null,
        lowStock: canKitchen ? Number(values.lowStock ?? 0) : null,
        productCount: canCatalog ? Number(values.productCount ?? 0) : null,
        categoryCount: canCatalog ? Number(values.categoryCount ?? 0) : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
