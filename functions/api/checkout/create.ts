import { createCheckoutResponse } from "../../_lib/create-checkout-response";

export const onRequestPost = async (context: {
  request: Request;
  env: Record<string, string | undefined>;
}) => createCheckoutResponse(context);
