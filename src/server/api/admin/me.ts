import { requireAdmin } from "../../require-admin";
import { json } from "../../security-headers";

export const onRequestGet: PagesFunction = async (context) => {
  const result = await requireAdmin(context);

  if ("response" in result) {
    return result.response;
  }

  return json({
    user: {
      id: result.user.id,
      email: result.user.email,
    },
    admin: result.adminUser,
  });
};
