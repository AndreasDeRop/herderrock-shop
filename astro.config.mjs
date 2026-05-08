import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

import sentry from "@sentry/astro";

const astroPrerenderEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/prerender"),
);
const astroLegacyEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/legacy"),
);
const sentryBuildOptions = process.env.SENTRY_AUTH_TOKEN
  ? {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG ?? "oddunitstudio",
      project: process.env.SENTRY_PROJECT ?? "javascript-astro",
      sourcemaps: {
        filesToDeleteAfterUpload: ["dist/**/*.map"],
      },
    }
  : {};

export default defineConfig({
  site: "https://shop.herderrock.be",
  output: "server",
  adapter: cloudflare(),

  vite: {
    resolve: {
      alias: {
        "astro/entrypoints/prerender": astroPrerenderEntrypoint,
        "astro/entrypoints/legacy": astroLegacyEntrypoint,
      },
    },
  },

  integrations: [
    sentry({
      telemetry: false,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      ...sentryBuildOptions,
    }),
  ],
});
