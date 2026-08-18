import Image from "next/image";
import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLogin() {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-background">
      <main className="mx-auto w-full max-w-md px-4">
        <Image
          src="/logo.png"
          alt="CricLedger logo"
          width={64}
          height={64}
          className="mx-auto mb-2"
          priority
        />
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-accent">
          CricLedger
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold text-text-primary">
          Admin sign in
        </h1>
        <p className="mt-1 text-center text-sm text-text-secondary">
          Viewing is public — signing in is only for recording money and
          matches.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          Forgot your password? Ask Ravi for a reset.
        </p>
      </main>
    </div>
  );
}
