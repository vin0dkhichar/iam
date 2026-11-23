import { NextRequest, NextResponse } from "next/server";
import { getBackendConfig } from "@/app/api/_lib/backend-config";
import { requireAuth } from "@/app/api/_lib/requireAuth";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const response = await fetch(`${getBackendConfig().backendApiUrl}/users/create_agency_admin`, {
    method: "POST",
    headers: auth.backendHeaders,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
