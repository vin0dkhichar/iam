import { NextRequest, NextResponse } from "next/server";

export function agentApiUrl(): string {
  return (process.env.BACKEND_API_URL ?? "").replace(/\/+$/, "");
}

export function authHeaders(req: NextRequest): Record<string, string> | NextResponse {
  const accessToken = req.cookies.get("X-Access-Token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  return {
    accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    Cookie: req.headers.get("cookie") ?? "",
  };
}

function rewriteSetCookieDomain(cookie: string, domain: string): string {
  const parts = cookie.split(";").map((part) => part.trim());
  let hasDomain = false;
  const rewritten = parts.map((part, index) => {
    if (index === 0) return part;
    if (part.toLowerCase().startsWith("domain=")) {
      hasDomain = true;
      return `Domain=${domain}`;
    }
    return part;
  });
  if (!hasDomain) rewritten.push(`Domain=${domain}`);
  return rewritten.join("; ");
}

export function copySetCookies(source: Response, target: NextResponse) {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  const rewrite = (cookie: string) => (domain ? rewriteSetCookieDomain(cookie, domain) : cookie);
  const cookies =
    typeof source.headers.getSetCookie === "function"
      ? source.headers.getSetCookie()
      : source.headers.get("set-cookie")
        ? [source.headers.get("set-cookie") as string]
        : [];
  for (const cookie of cookies) {
    target.headers.append("Set-Cookie", rewrite(cookie));
  }
}

export async function agentFetch(req: NextRequest, path: string, init: RequestInit = {}) {
  const headers = authHeaders(req);
  if (headers instanceof NextResponse) return headers;
  const response = await fetch(`${agentApiUrl()}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  const next = NextResponse.json(data, { status: response.status });
  copySetCookies(response, next);
  return next;
}
