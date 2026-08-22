"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  // ?next= is read at SUBMIT time, not during render. useSearchParams()
  // would make this component client-only under Cache Components, which
  // means the sign-in form would be a skeleton until JS hydrates — on the
  // one page that must work immediately.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!body.success) {
        const code = body.error?.code;
        setError(
          code === "ADMIN_REVOKED"
            ? "This admin account has been revoked."
            : code === "INVALID_CREDENTIALS"
              ? "Invalid username or password"
              : "Server error — please try again in a moment.",
        );
        return;
      }
      // AccessGate and the proxy bounce here with ?next=, so a member
      // who was merely signed out lands back where they were.
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(
        body.data.force_change
          ? "/admin/password"
          : (next ??
            (body.data.platform_role === "megaadmin" ? "/ops" : "/")),
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          Username
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      {error && <p className="text-sm text-debit">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-xs text-text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent">
          Create an account
        </Link>
      </p>
    </form>
  );
}
