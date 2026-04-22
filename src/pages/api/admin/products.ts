import type { APIRoute } from "astro";
import { onRequestGet } from "../../../server/api/admin/products";
import { withCloudflareEnv } from "../../../server/cloudflare-handler";

export const GET: APIRoute = withCloudflareEnv(onRequestGet);
