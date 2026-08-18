export function normalizeProductImageUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const withoutPublicPrefix = trimmed
    .replace(/^\.?\//, "/")
    .replace(/^\/?public\//i, "/");

  if (withoutPublicPrefix.startsWith("/")) {
    return withoutPublicPrefix;
  }

  return `/${withoutPublicPrefix}`;
}
