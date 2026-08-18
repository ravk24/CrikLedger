"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { ThemeSwitcher } from "@/components/theme-switcher";

type SessionAdmin = { name: string; role: string | null };

export function PublicHeader() {
  const [admin, setAdmin] = useState<SessionAdmin | null>(null);

  // Public pages are static — the signed-in decoration hydrates client-side.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.success && !body.data.force_change) {
          setAdmin({
            name: body.data.name,
            role: body.data.team_role ?? body.data.platform_role,
          });
          // Re-links returning admins whose session cookie outlived local
          // analytics state; no-op when the distinct id is unchanged.
          posthog.identify(body.data.admin_id, {
            name: body.data.name,
            platform_role: body.data.platform_role,
            active_team: body.data.active_team,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="CricLedger logo"
              width={32}
              height={32}
              priority
            />
            <h1 className="flex items-center">
              <span className="sr-only">CricLedger</span>
              <Image
                src="/wordmark-light.svg"
                alt=""
                width={173}
                height={26}
                priority
                unoptimized
                className="dark:hidden"
              />
              <Image
                src="/wordmark-dark.svg"
                alt=""
                width={173}
                height={26}
                priority
                unoptimized
                className="hidden dark:block"
              />
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/admin"
              className={
                admin
                  ? "rounded-full bg-scheduled-light px-3 py-1 text-sm font-medium text-scheduled-foreground"
                  : "rounded-full border border-border bg-surface-secondary px-3 py-1 text-sm font-medium text-text-primary"
              }
            >
              Admin
            </Link>
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      {admin && (
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <div className="rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-sm text-text-secondary">
              Welcome,{" "}
              <span className="font-medium text-text-primary">
                {admin.name}
              </span>{" "}
              👋
            </p>
          </div>
        </div>
      )}
    </>
  );
}
