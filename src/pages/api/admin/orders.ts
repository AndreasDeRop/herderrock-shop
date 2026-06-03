import type { APIRoute } from "astro";
import { onRequestGet } from "../../../server/api/admin/orders";
import { withCloudflareEnv } from "../../../server/cloudflare-handler";

export const GET: APIRoute = withCloudflareEnv(onRequestGet);
