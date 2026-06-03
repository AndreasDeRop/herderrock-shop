import type { APIRoute } from "astro";
import { onRequestPost } from "../../../../server/api/admin/products/add-variant";
import { withCloudflareEnv } from "../../../../server/cloudflare-handler";

export const POST: APIRoute = withCloudflareEnv(onRequestPost);
