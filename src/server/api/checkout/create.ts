import { createCheckoutResponse } from "../../create-checkout-response";

export const onRequestPost = async (context: {
  request: Request;
  env: Record<string, string | undefined>;
}) => createCheckoutResponse(context);
