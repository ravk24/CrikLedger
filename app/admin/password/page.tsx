import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdmin } from "@/lib/session";

async function PasswordGate() {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <>
      {admin.mustChangePassword && (
        <p className="mx-auto w-fit rounded-full bg-low-light px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-low-foreground">
          Required before you continue
        </p>
      )}
      <h1 className="mt-2 text-center text-2xl font-bold text-text-primary">
        Set a new password
      </h1>
      <p className="mt-1 text-center text-sm text-text-secondary">
        {admin.mustChangePassword
          ? "Every admin action is blocked until this is done — no skip."
          : "Choose a new password for your admin account."}
      </p>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <ChangePasswordForm />
      </div>
    </>
  );
}

export default function AdminPassword() {
  return (
    <div className="flex min-h-svh flex-col justify-center bg-background">
      <main className="mx-auto w-full max-w-md px-4">
        <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
          <PasswordGate />
        </Suspense>
      </main>
    </div>
  );
}
