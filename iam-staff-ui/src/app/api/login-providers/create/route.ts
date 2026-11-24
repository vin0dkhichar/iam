import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

// Login provider create removed from UI — edit only.
// export async function POST(req: NextRequest) {
//   return proxyToBackend({
//     req,
//     targetEndpoint: "/login-providers/create_login_provider",
//   });
// }

export async function POST(_req: NextRequest) {
  return Response.json({ error: "Login provider create is disabled." }, { status: 410 });
}
