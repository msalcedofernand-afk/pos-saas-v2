import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest, getUserMemberships } from "@/lib/auth/api";
import { handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.response) return auth.response;
    const data = await getUserMemberships(auth.user.id);
    return NextResponse.json({ data, activeOrganizationId: auth.user.organizationId });
  } catch (error) {
    return handleApiError(error);
  }
}
