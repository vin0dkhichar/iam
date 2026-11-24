import { NextRequest } from "next/server";
import { upstreamFetch } from "@/app/api/_lib/upstream";

export async function POST(request: NextRequest) {
  return upstreamFetch(
    request,
    "registry",
    "/register-metadata/get_register_fields",
    (body) => ({
      pagination_request: {
        current_page: body.current_page ?? 1,
        page_size: body.page_size ?? 20,
        sort_by: body.sort_by ?? "",
        filter_by: body.filter_by ?? "",
        search_text: body.search_text ?? "",
      },
      request_payload: {
        register_id: body.register_id,
      },
    }),
    (responseBody) => ({
      register_id: responseBody?.response_payload?.register_id,
      register_mnemonic: responseBody?.response_payload?.register_mnemonic,
      fields: responseBody?.response_payload?.fields || [],
      pagination: responseBody?.pagination_response,
    }),
  );
}
