"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
};

// Destructive confirmations (revoke, delete match, deactivate,
// reset-edits) — never a bare destructive button (ui-rules).
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80%] max-w-sm rounded-lg bg-surface">
        <DialogHeader>
          <DialogTitle className="text-left text-lg font-semibold text-text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-text-secondary">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-11 rounded-md border border-border bg-surface shadow-card px-4 text-sm font-medium text-text-primary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "h-11 rounded-md px-4 text-sm font-medium disabled:opacity-60",
              destructive
                ? "bg-debit text-white"
                : "bg-accent text-accent-foreground",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
