import { createSupabaseAdmin } from "./supabase-admin";
import { json } from "./security-headers";
import { addServerBreadcrumb, setAdminUserContext } from "./sentry";

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
  let supabase;

  try {
    supabase = createSupabaseAdmin(context.env);
  } catch (error) {
    console.error("Admin auth serverconfig fout:", error);
    return {
      response: json(
        { error: "Admin-auth serverconfig ontbreekt of is ongeldig." },
        500,
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    addServerBreadcrumb({
      category: "admin.auth",
      message: "Admin sessie ongeldig",
      level: "warning",
    });
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
    addServerBreadcrumb({
      category: "admin.auth",
      message: "Adminrechten geweigerd",
      data: {
        userId: user.id,
        email: user.email ?? undefined,
      },
      level: "warning",
    });
    return {
      response: json({ error: "Geen adminrechten." }, 403),
    };
  }

  setAdminUserContext({
    id: user.id,
    email: user.email,
  });

  addServerBreadcrumb({
    category: "admin.auth",
    message: "Adminrechten bevestigd",
    data: {
      userId: user.id,
      email: user.email ?? undefined,
    },
  });

  return {
    supabase,
    user,
    adminUser,
  };
}
