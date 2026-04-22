import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

const astroPrerenderEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/prerender"),
);
const astroLegacyEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/legacy"),
);

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
});
