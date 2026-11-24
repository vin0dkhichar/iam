import { NextRequest } from "next/server";
import { agentFetch } from "../_lib/agent";

export async function GET(req: NextRequest) {
  const currentPage = Number(req.nextUrl.searchParams.get("current_page") || "1");
  const pageSize = Number(req.nextUrl.searchParams.get("page_size") || "10");
  return agentFetch(req, "/users", {
    method: "POST",
    body: JSON.stringify({
      current_page: Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1,
      page_size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10,
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return agentFetch(req, "/users/create", { method: "POST", body });
}
