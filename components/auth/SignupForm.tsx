"use client";

import { useEffect, useState } from "react";
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
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">User id</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          required
          className={FIELD}
        />
        {availability === "free" && (
          <span className="flex items-center gap-1 text-xs text-credit">
            <Check size={13} /> Available
          </span>
        )}
        {availability === "taken" && (
          <span className="flex items-center gap-1 text-xs text-debit">
            <X size={13} /> Already taken
          </span>
        )}
        {availability === "invalid" && (
          <span className="text-xs text-text-muted">
            3–40 characters: lowercase letters, digits, underscores.
          </span>
        )}
        {availability === "checking" && (
          <span className="text-xs text-text-muted">Checking…</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className={FIELD}
        />
        <span className="text-xs text-text-muted">
          Identifies your account, and is where purchase and support replies go.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className={FIELD}
        />
        {password.length > 0 && !longEnough && (
          <span className="text-xs text-text-muted">
            At least 8 characters.
          </span>
        )}
      </label>

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
