import { NextRequest } from "next/server";
import { agentFetch } from "../../_lib/agent";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return agentFetch(req, `/users/delete?user_id=${encodeURIComponent(body.user_id)}`, {
    method: "POST",
  });
}
