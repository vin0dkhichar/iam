import { NextRequest } from "next/server";
import { agentFetch } from "../_lib/agent";

export async function GET(req: NextRequest) {
  return agentFetch(req, "/users");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return agentFetch(req, "/users/create", { method: "POST", body });
}
