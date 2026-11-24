import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authHeaders, copySetCookies } from "./agent";

const CSRF_COOKIE = "X-CSRF-Token";
const CSRF_HEADER = "X-CSRF-Token";

function applicationMnemonic(): string {
  return process.env.APPLICATION_MNEMONIC || "agent-portal";
}

function masterdataApiUrl(): string {
  return (process.env.MASTERDATA_API_URL ?? "").replace(/\/+$/, "");
}

function wrapEnvelope(payload: Record<string, unknown>, origin: string) {
  return {
    request_header: {
      sender_app_mnemonic: applicationMnemonic(),
      sender_app_url: origin,
      request_id: randomUUID(),
      request_timestamp: new Date().toISOString(),
    },
    request_body: payload,
  };
}

function registryUpstreamHeaders(accessToken: string, csrfToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    [CSRF_HEADER]: csrfToken,
    Cookie: `${CSRF_COOKIE}=${csrfToken}`,
  };
}

type UpstreamKind = "masterdata" | "registry";

export async function upstreamFetch(
  req: NextRequest,
  kind: UpstreamKind,
  path: string,
  buildPayload: (body: any) => Record<string, unknown>,
  transform: (responseBody: any) => unknown,
) {
  const headersOrError = authHeaders(req);
  if (headersOrError instanceof NextResponse) return headersOrError;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const origin = req.headers.get("origin") || `${proto}://${host}`;

  let baseUrl = "";
  let upstreamHeaders: Record<string, string> = {
    ...headersOrError,
    "Content-Type": "application/json",
  };

  if (kind === "masterdata") {
    baseUrl = masterdataApiUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: "MASTERDATA_API_URL is not configured" }, { status: 500 });
    }
  } else {
    // Same as staff-ui: registry base URL comes from the application/agency api_url.
    const fromBody =
      typeof body?.api_url === "string" ? body.api_url.trim().replace(/\/+$/, "") : "";
    baseUrl = fromBody;
    if (!baseUrl) {
      return NextResponse.json(
        {
          error:
            "api_url is required to call the registry API. Set it on the agency application.",
        },
        { status: 400 },
      );
    }
    const accessToken = req.cookies.get("X-Access-Token")?.value || "";
    const csrfToken =
      (typeof body?.csrf_token === "string" && body.csrf_token.trim()) ||
      req.cookies.get(CSRF_COOKIE)?.value ||
      randomUUID();
    upstreamHeaders = registryUpstreamHeaders(accessToken, csrfToken);
    if (body && typeof body === "object") {
      const rest = { ...body };
      delete rest.api_url;
      delete rest.csrf_token;
      delete rest.access_token;
      body = rest;
    }
  }

  const payload = buildPayload(body);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(wrapEnvelope(payload, origin)),
  });
  const responseBody = await response.json().catch(() => ({}));

  if (responseBody?.response_header?.response_status === "ERROR") {
    const next = NextResponse.json(
      {
        error: responseBody.response_header.response_error_message,
        code: responseBody.response_header.response_error_code,
      },
      { status: 400 },
    );
    copySetCookies(response, next);
    return next;
  }

  if (!response.ok) {
    const next = NextResponse.json(
      { error: responseBody?.error || responseBody?.detail || "Upstream request failed" },
      { status: response.status },
    );
    copySetCookies(response, next);
    return next;
  }

  const data = transform(responseBody?.response_body ?? responseBody);
  const next = NextResponse.json(data);
  copySetCookies(response, next);
  return next;
}
