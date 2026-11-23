import { NextRequest, NextResponse } from "next/server";
import { agentApiUrl, authHeaders, copySetCookies } from "../_lib/agent";

export async function GET(req: NextRequest) {
  const headers = authHeaders(req);
  if (headers instanceof NextResponse) return headers;
  const response = await fetch(`${agentApiUrl()}/auth/get_user_profile`, {
    headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  const next = NextResponse.json(data, { status: response.status });
  copySetCookies(response, next);
  return next;
}
