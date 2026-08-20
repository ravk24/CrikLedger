import Image from "next/image";
import { SignupForm } from "@/components/auth/SignupForm";

// Self-serve signup. Outside the (app) route group on purpose — no tab
// bar, no header, nothing to do but finish or leave.
export default function Signup() {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-background">
      <main className="mx-auto w-full max-w-md px-4 py-8">
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
          Create an account
        </h1>
        <p className="mt-1 text-center text-sm text-text-secondary">
          Free to create. Buy a Team Ledger when you&apos;re ready to run
          your team.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <SignupForm />
        </div>
      </main>
    </div>
  );
}
