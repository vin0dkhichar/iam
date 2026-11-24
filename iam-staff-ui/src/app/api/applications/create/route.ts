import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

// Staff application create disabled. Agencies use POST /api/agencies instead.
// export async function POST(req: NextRequest) {
//   return proxyToBackend({
//     req,
//     targetEndpoint: "/applications/create_application",
//   });
// }

export async function POST(_req: NextRequest) {
  return Response.json(
    { error: "Application create is disabled. Use /api/agencies for agencies." },
    { status: 410 },
  );
}
