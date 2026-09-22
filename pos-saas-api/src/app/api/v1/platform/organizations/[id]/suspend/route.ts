import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/response";
import { runPlatformOrganizationAction } from "@/lib/platform/organization-actions";
import { boundedText } from "@/lib/validation/rules";

const suspendSchema = z.object({ reason: boundedText(500, 3) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = suspendSchema.parse(await request.json().catch(() => ({})));
    return runPlatformOrganizationAction(request, (await params).id, "suspend", { reason: body.reason });
  } catch (error) {
    return handleApiError(error);
  }
}
