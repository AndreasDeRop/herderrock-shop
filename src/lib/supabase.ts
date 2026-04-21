import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl) {
  throw new Error("Missing PUBLIC_SUPABASE_URL");
}

if (!supabasePublishableKey) {
  throw new Error("Missing PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

try {
  new URL(supabaseUrl);
} catch {
  throw new Error(`Ongeldige PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
}

async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (import.meta.env.DEV) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Kon verbinding maken met Supabase. Controleer PUBLIC_SUPABASE_URL. Details: ${message}`,
      );
    }

    throw new Error("Kon verbinding maken met de shopdata.");
  }
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: "pkce",
  },
  global: {
    fetch: supabaseFetch,
  },
});
