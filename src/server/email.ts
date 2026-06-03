import { env as cloudflareEnv } from "cloudflare:workers";

type ServerEnv = Record<string, string | undefined>;

type SendEmailOptions = {
  env: ServerEnv;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

function getEnvValue(env: ServerEnv, key: string) {
  return (
    env[key] ??
    cloudflareEnv[key as keyof typeof cloudflareEnv] ??
    process.env?.[key]
  );
}

export async function sendEmail(options: SendEmailOptions) {
  const apiKey = getEnvValue(options.env, "RESEND_API_KEY");
  const from = getEnvValue(options.env, "ORDER_CONFIRMATION_FROM");
  const replyTo =
    options.replyTo ?? getEnvValue(options.env, "ORDER_CONFIRMATION_REPLY_TO");

  if (!apiKey || !from) {
    console.warn("Order email overgeslagen: ontbrekende mailconfig", {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
    });

    return {
      sent: false,
      skipped: "missing email configuration",
    } as const;
  }

  const payload: Record<string, unknown> = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  if (options.tags?.length) {
    payload.tags = options.tags;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey
        ? {
            "Idempotency-Key": options.idempotencyKey,
          }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();

  if (!response.ok) {
    console.error("Resend email fout", {
      status: response.status,
      body: responseBody.slice(0, 1000),
    });

    throw new Error(
      `Resend email fout (${response.status}): ${responseBody.slice(0, 500)}`,
    );
  }

  const result = responseBody ? JSON.parse(responseBody) : {};

  return {
    sent: true,
    id: result.id as string | undefined,
  } as const;
}
