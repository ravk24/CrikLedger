import Link from "next/link";
import { Shield } from "lucide-react";

// Chrome for the platform-operator console. Deliberately unlike the team
// app: no tab bar, its own header, an explicit badge. The two authorities
// should never look like the same surface.
export function OpsHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
        <Link href="/ops" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-surface-secondary text-text-secondary">
            <Shield size={15} />
          </span>
          <span className="text-sm font-bold text-text-primary">Operator</span>
        </Link>
        <nav className="flex items-center gap-3 text-xs font-medium text-text-secondary">
          <Link href="/ops/teams">Teams</Link>
          <Link href="/ops/accounts">Accounts</Link>
          <Link href="/">Exit</Link>
        </nav>
      </div>
    </header>
  );
}
