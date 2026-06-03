import * as Sentry from "@sentry/cloudflare";

type RequestMeta = {
  method: string;
  path: string;
  requestId?: string | null;
};

export function startServerSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  callback: () => Promise<T> | T,
) {
  const filteredAttributes = Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );

  return Sentry.startSpan(
    {
      name,
      op: "app.task",
      attributes: filteredAttributes,
    },
    callback,
  );
}

export function setServerRequestContext(meta: RequestMeta) {
  Sentry.setTag("request.method", meta.method);
  Sentry.setTag("request.path", meta.path);

  if (meta.requestId) {
    Sentry.setTag("request.id", meta.requestId);
  }

  Sentry.setContext("request", {
    method: meta.method,
    path: meta.path,
    requestId: meta.requestId ?? undefined,
  });
}

export function setAdminUserContext(user: {
  id: string;
  email?: string | null;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
  });
  Sentry.setTag("admin.authenticated", "true");
}

export function addServerBreadcrumb(options: {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  level?: "info" | "warning" | "error";
}) {
  Sentry.addBreadcrumb({
    category: options.category,
    message: options.message,
    data: options.data,
    level: options.level,
  });
}

export function captureServerException(
  error: unknown,
  options: {
    request?: RequestMeta;
    tags?: Record<string, string>;
    extras?: Record<string, unknown>;
    contexts?: Record<string, Record<string, unknown>>;
  } = {},
) {
  Sentry.withScope((scope) => {
    if (options.request) {
      scope.setTag("request.method", options.request.method);
      scope.setTag("request.path", options.request.path);

      if (options.request.requestId) {
        scope.setTag("request.id", options.request.requestId);
      }
    }

    for (const [key, value] of Object.entries(options.tags ?? {})) {
      scope.setTag(key, value);
    }

    for (const [key, value] of Object.entries(options.extras ?? {})) {
      scope.setExtra(key, value);
    }

    for (const [key, value] of Object.entries(options.contexts ?? {})) {
      scope.setContext(key, value);
    }

    Sentry.captureException(error);
  });
}

export async function captureServerErrorResponse(
  response: Response,
  options: {
    request: RequestMeta;
    source: string;
  },
) {
  if (response.status < 500) {
    return;
  }

  let responseBody = "";

  try {
    responseBody = await response.clone().text();
  } catch {
    responseBody = "";
  }

  captureServerException(
    new Error(
      `${options.source} returned ${response.status} for ${options.request.method} ${options.request.path}`,
    ),
    {
      request: options.request,
      tags: {
        "sentry.source": options.source,
        "response.status": String(response.status),
      },
      extras: {
        responseBody: responseBody.slice(0, 2_000),
      },
    },
  );
}
