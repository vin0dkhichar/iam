import { NextRequest } from "next/server";
import { agentFetch } from "../../_lib/agent";

export async function GET(req: NextRequest) {
  return agentFetch(req, "/users/data-policies");
}
