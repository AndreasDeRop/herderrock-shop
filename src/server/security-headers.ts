const baseSecurityHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

export function withSecurityHeaders(headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers);

  for (const [key, value] of Object.entries(baseSecurityHeaders)) {
    if (!responseHeaders.has(key)) {
      responseHeaders.set(key, value);
    }
  }

  return responseHeaders;
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = withSecurityHeaders(headers);
  responseHeaders.set("content-type", "application/json");

  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}
