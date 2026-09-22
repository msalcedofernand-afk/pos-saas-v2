import { NextRequest } from "next/server";
import { runPlatformOrganizationAction } from "@/lib/platform/organization-actions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return runPlatformOrganizationAction(request, (await params).id, "reactivate", {});
}
