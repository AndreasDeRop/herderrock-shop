import * as Sentry from "@sentry/astro";

const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN;
const sentryEnvironment =
  import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
const tracesSampleRate = import.meta.env.DEV ? 1.0 : 0.2;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: sentryEnvironment,
  tracesSampleRate,
  sendDefaultPii: false,
});
