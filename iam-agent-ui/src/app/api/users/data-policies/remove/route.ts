import { NextRequest } from "next/server";
import { agentFetch } from "../../../_lib/agent";

export async function POST(req: NextRequest) {
  return agentFetch(req, "/users/data-policies/remove", { method: "POST", body: await req.text() });
}
