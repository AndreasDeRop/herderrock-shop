import type { APIRoute } from "astro";
import { onRequestGet } from "../../../server/api/admin/me";
import { withCloudflareEnv } from "../../../server/cloudflare-handler";

export const GET: APIRoute = withCloudflareEnv(onRequestGet);
