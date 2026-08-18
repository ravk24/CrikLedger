import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!token || !host) {
  if (process.env.NODE_ENV === "development") {
    const variable = token
      ? "NEXT_PUBLIC_POSTHOG_HOST"
      : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
    console.error(
      `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
    );
  }
} else {
  posthog.init(token, {
    api_host: "/ingest",
    // Dashboard/toolbar links — the app UI domain, not the ingestion host.
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    capture_exceptions: true,
    tracing_headers: [window.location.hostname],
  });
}
