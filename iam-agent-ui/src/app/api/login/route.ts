import { NextRequest, NextResponse } from "next/server";
import { agentApiUrl, copySetCookies } from "../_lib/agent";

export async function GET(req: NextRequest) {
  let redirectUri = req.nextUrl.searchParams.get("redirect_uri") || "/";
  if (redirectUri.startsWith("/")) {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    redirectUri = `${proto}://${host}${redirectUri}`;
  }
  const providerId = process.env.LOGIN_PROVIDER_ID || "agency-web";
  const response = await fetch(
    `${agentApiUrl()}/auth/start_authentication_transaction?id=${providerId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    { method: "POST", headers: { accept: "application/json" }, body: "" },
  );
  const data = await response.json();
  if (!data.redirectUrl) {
    return NextResponse.json({ error: "Failed to start sign in" }, { status: 500 });
  }
  const next = NextResponse.redirect(data.redirectUrl);
  copySetCookies(response, next);
  return next;
}
