import Image from "next/image";
import { LoginForm } from "@/components/admin/LoginForm";

// The canonical sign-in page. /admin/login redirects here — signing in
// is no longer an admin-only act now that anyone can hold an account.
//
// Deliberately outside the (app) route group: no tab bar, no header.
export default function Login() {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-background">
      <main className="mx-auto w-full max-w-md px-4">
        <Image
          src="/logo.png"
          alt="CrikLedger logo"
          width={64}
          height={64}
          className="mx-auto mb-2"
          priority
        />
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-accent">
          CrikLedger
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold text-text-primary">
          Sign in
        </h1>
        <p className="mt-1 text-center text-sm text-text-secondary">
          Browsing is free — sign in to run your team&apos;s ledger.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-surface shadow-card p-4">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          Forgot your password? Ask your team&apos;s superadmin for a reset.
        </p>
      </main>
    </div>
  );
}
