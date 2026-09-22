import { NextRequest } from "next/server";
import { runPlatformUserAction } from "@/lib/platform/user-actions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return runPlatformUserAction(request, (await params).id, "unblock");
}
