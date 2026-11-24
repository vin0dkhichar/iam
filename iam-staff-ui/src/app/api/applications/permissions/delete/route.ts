import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

// Permissions delete removed from staff UI (view only).
// export async function POST(req: NextRequest) {
//   return proxyToBackend({
//     req,
//     targetEndpoint: "/applications/delete_permission",
//   });
// }

export async function POST(_req: NextRequest) {
  return Response.json({ error: "Permission delete is disabled." }, { status: 410 });
}
