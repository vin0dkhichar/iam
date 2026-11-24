import { NextRequest } from "next/server";
import { upstreamFetch } from "@/app/api/_lib/upstream";

export async function POST(request: NextRequest) {
  return upstreamFetch(
    request,
    "masterdata",
    "/geo/get_all_geo_levels",
    (body) => ({
      pagination_request: {
        current_page: body.current_page ?? 1,
        page_size: body.page_size ?? 20,
        sort_by: body.sort_by ?? "",
        filter_by: body.filter_by ?? "",
        search_text: body.search_text ?? "",
      },
      request_payload: {},
    }),
    (responseBody) => responseBody?.response_payload ?? [],
  );
}
