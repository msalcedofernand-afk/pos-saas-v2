import { NextResponse } from "next/server";

const version = process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "v1";

export function GET() {
  return NextResponse.json({ status: "ok", version });
}
