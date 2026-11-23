import { NextResponse } from "next/server";
import { agentApiUrl } from "../_lib/agent";

export async function GET() {
  return NextResponse.redirect(`${agentApiUrl()}/auth/logout`);
}
