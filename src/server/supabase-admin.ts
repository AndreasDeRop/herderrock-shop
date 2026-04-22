import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin(env: Record<string, string | undefined>) {
  const serverKey =
    env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("Missing PUBLIC_SUPABASE_URL");
  }

  if (!serverKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
