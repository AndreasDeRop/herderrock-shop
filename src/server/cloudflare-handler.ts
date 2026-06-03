import { env } from "cloudflare:workers";
import type { APIContext } from "astro";
import { json } from "./security-headers";
import {
  captureServerErrorResponse,
  captureServerException,
  setServerRequestContext,
  startServerSpan,
} from "./sentry";

export type LegacyWorkerContext = {
  request: Request;
  env: Record<string, string | undefined>;
};

export type LegacyWorkerHandler = (
  context: LegacyWorkerContext,
) => Response | Promise<Response>;

export function withCloudflareEnv(handler: LegacyWorkerHandler) {
  return async ({ request }: APIContext) => {
    const url = new URL(request.url);
    const requestMeta = {
      method: request.method,
      path: url.pathname,
      requestId: request.headers.get("cf-ray"),
    };

    setServerRequestContext(requestMeta);

    return startServerSpan(
      `${request.method} ${url.pathname}`,
      {
        "http.method": request.method,
        "http.route": url.pathname,
      },
      async () => {
        try {
          const response = await handler({
            request,
            env: env as Record<string, string | undefined>,
          });

          await captureServerErrorResponse(response, {
            request: requestMeta,
            source: "astro.api",
          });

          return response;
        } catch (error) {
          captureServerException(error, {
            request: requestMeta,
            tags: {
              "sentry.source": "astro.api",
            },
          });

          return json({ error: "Er ging iets mis op de server." }, 500);
        }
      },
    );
  };
}
