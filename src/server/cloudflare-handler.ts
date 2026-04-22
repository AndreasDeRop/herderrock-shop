import { env } from "cloudflare:workers";
import type { APIContext } from "astro";

export type LegacyWorkerContext = {
  request: Request;
  env: Record<string, string | undefined>;
};

export type LegacyWorkerHandler = (
  context: LegacyWorkerContext,
) => Response | Promise<Response>;

export function withCloudflareEnv(handler: LegacyWorkerHandler) {
  return ({ request }: APIContext) =>
    handler({
      request,
      env: env as Record<string, string | undefined>,
    });
}
