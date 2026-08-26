import Link from "next/link";

// Rendered inside the (app) shell (header + tab bar stay), so a mistyped
// or stale link reads as a dead end in the app, not a broken site.
export default function AppNotFound() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-6 text-center">
      <h2 className="text-base font-semibold text-text-primary">
        There&rsquo;s nothing here
      </h2>
      <p className="max-w-xs text-sm text-text-secondary">
        That page doesn&rsquo;t exist, or the link is out of date.
      </p>
      <Link
        href="/"
        className="mt-1 flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
      >
        Go to Home
      </Link>
    </section>
  );
}
