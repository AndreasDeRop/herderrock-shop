import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const astroPrerenderEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/prerender"),
);
const astroLegacyEntrypoint = fileURLToPath(
  import.meta.resolve("astro/entrypoints/legacy"),
);

export default defineConfig({
  site: "https://shop.herderrock.be",
  vite: {
    resolve: {
      alias: {
        "astro/entrypoints/prerender": astroPrerenderEntrypoint,
        "astro/entrypoints/legacy": astroLegacyEntrypoint,
      },
    },
  },
});
