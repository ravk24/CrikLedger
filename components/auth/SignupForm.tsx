"use client";

import { startTransition, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";

type Availability = "idle" | "checking" | "free" | "taken" | "invalid";

const FIELD =
  "h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Self-serve signup: user id + password + email, exactly the three
// fields specced. The account it creates owns nothing — purchases grant
// teams and tournaments (Feature 5), so there is no role to choose here.
export function SignupForm() {
  const router = useRouter();
  // Each field's title is a <label htmlFor> and its helper/status line is
  // linked by aria-describedby, so a screen reader announces "Email" as the
  // field's name and the helper as its description — not one run-on name
  // (they used to share one wrapping <label>; test_docs F-5, 2026-11-14).
  const fieldId = useId();
  const ids = {
    user: `${fieldId}-user`,
    userHint: `${fieldId}-user-hint`,
    email: `${fieldId}-email`,
    emailHint: `${fieldId}-email-hint`,
    password: `${fieldId}-password`,
    passwordHint: `${fieldId}-password-hint`,
  };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Debounced availability check. The endpoint is a deliberate
  // enumeration oracle (it has to be), so it returns a bare boolean.
  useEffect(() => {
    const value = username.trim();
    if (value.length < 3) {
      setAvailability(value.length === 0 ? "idle" : "invalid");
      return;
    }
    setAvailability("checking");
    const timer = setTimeout(() => {
      let cancelled = false;
      fetch("/api/auth/username-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      })
        .then((r) => r.json())
        .then((body) => {
          if (cancelled) return;
          if (!body?.success) return setAvailability("idle");
          setAvailability(
            !body.data.valid
              ? "invalid"
              : body.data.available
                ? "free"
                : "taken",
          );
        })
        .catch(() => !cancelled && setAvailability("idle"));
      return () => {
        cancelled = true;
      };
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const longEnough = password.length >= 8;
  const canSubmit =
    availability === "free" && longEnough && email.includes("@") && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          email: email.trim(),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        const code = body.error?.code;
        setError(
          code === "USERNAME_TAKEN"
            ? "That user id is taken."
            : code === "EMAIL_TAKEN"
              ? "That email is already registered."
              : code === "INVALID_BODY"
                ? "Check the details and try again."
                : "Server error — please try again in a moment.",
        );
        return;
      }
      // Signup signs you in; there is no team yet, so land on the app.
      router.push("/");
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.user} className="text-xs font-medium text-text-secondary">
          User id
        </label>
        <input
          id={ids.user}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          required
          aria-describedby={availability === "idle" ? undefined : ids.userHint}
          className={FIELD}
        />
        {/* At most one status line renders at a time, so they share an id. */}
        {availability === "free" && (
          <span id={ids.userHint} className="flex items-center gap-1 text-xs text-credit">
            <Check size={13} aria-hidden /> Available
          </span>
        )}
        {availability === "taken" && (
          <span id={ids.userHint} className="flex items-center gap-1 text-xs text-debit">
            <X size={13} aria-hidden /> Already taken
          </span>
        )}
        {availability === "invalid" && (
          <span id={ids.userHint} className="text-xs text-text-muted">
            3–40 characters: lowercase letters, digits, underscores.
          </span>
        )}
        {availability === "checking" && (
          <span id={ids.userHint} className="text-xs text-text-muted">Checking…</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.email} className="text-xs font-medium text-text-secondary">
          Email
        </label>
        <input
          id={ids.email}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          aria-describedby={ids.emailHint}
          className={FIELD}
        />
        <span id={ids.emailHint} className="text-xs text-text-muted">
          Identifies your account, and is where purchase and support replies go.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.password} className="text-xs font-medium text-text-secondary">
          Password
        </label>
        <input
          id={ids.password}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          aria-describedby={
            password.length > 0 && !longEnough ? ids.passwordHint : undefined
          }
          className={FIELD}
        />
        {password.length > 0 && !longEnough && (
          <span id={ids.passwordHint} className="text-xs text-text-muted">
            At least 8 characters.
          </span>
        )}
      </div>

      {error && <p className="text-sm text-debit">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-xs text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
