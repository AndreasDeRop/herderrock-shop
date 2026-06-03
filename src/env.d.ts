/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SENTRY_DSN: string;
  readonly PUBLIC_SENTRY_ENVIRONMENT: string;
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly SHOP_CLOSES_AT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
