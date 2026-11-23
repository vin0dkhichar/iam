import { NextRequest } from "next/server";
import { agentFetch } from "../../_lib/agent";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return agentFetch(req, "/users/assign_roles", { method: "POST", body });
}
