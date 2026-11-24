import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

// Applications list delete removed — agencies use set-active soft toggle instead.
// export async function POST(req: NextRequest) {
//   return proxyToBackend({
//     req,
//     targetEndpoint: "/applications/delete_application",
//   });
// }

export async function POST(_req: NextRequest) {
  return Response.json(
    { error: "Application delete is disabled; use set-active for soft delete." },
    { status: 410 },
  );
}
