import { NextRequest } from "next/server";
import { upstreamFetch } from "@/app/api/_lib/upstream";

export async function POST(request: NextRequest) {
  return upstreamFetch(
    request,
    "masterdata",
    "/geo/get_geo_level_values",
    (body) => ({
      pagination_request: {
        current_page: body.current_page ?? 1,
        page_size: body.page_size ?? 20,
        sort_by: body.sort_by ?? "",
        filter_by: body.filter_by ?? "",
        search_text: body.search_text ?? "",
      },
      request_payload: {
        level_id: body.level_id,
        parent_level_value_id: body.parent_level_value_id ?? "",
      },
    }),
    (responseBody) => responseBody?.response_payload ?? [],
  );
}
