import * as Sentry from "@sentry/astro";

const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN;
const sentryEnvironment =
  import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
const tracesSampleRate = import.meta.env.DEV ? 1.0 : 0.2;
const replaysSessionSampleRate = import.meta.env.DEV ? 0 : 0.05;

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: sentryEnvironment,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: false,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/shop\.herderrock\.be/,
    /^https:\/\/herderrock-shop\.andreasderop\.workers\.dev/,
  ],
});
