import type { APIRoute } from "astro";
import { onRequestPost } from "../../../server/api/checkout/create";
import { withCloudflareEnv } from "../../../server/cloudflare-handler";

export const POST: APIRoute = withCloudflareEnv(onRequestPost);
