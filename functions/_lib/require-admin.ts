import { createSupabaseAdmin } from "./supabase-admin";
import { json } from "./security-headers";

export async function requireAdmin(context: {
  request: Request;
  env: Record<string, string>;
}) {
  const authHeader = context.request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      response: json({ error: "Niet ingelogd." }, 401),
    };
  }

  const accessToken = match[1];
  const supabase = createSupabaseAdmin(context.env);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      response: json({ error: "Ongeldige sessie." }, 401),
    };
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id, email, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminUser || !adminUser.is_active) {
    return {
      response: json({ error: "Geen adminrechten." }, 403),
    };
  }

  return {
    supabase,
    user,
    adminUser,
  };
}
