"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  // Pinned below the scrollable body — always visible (wizard buttons).
  footer?: React.ReactNode;
};

// The one modal wrapper — every admin form goes through this,
// never raw Dialog in feature code (ui-rules).
export function SheetShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-4rem)] w-[calc(100%-3rem)] max-w-md flex-col gap-0 overflow-hidden rounded-lg border-border bg-surface p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 px-4 pt-5 pb-2">
          <DialogTitle className="text-left text-lg font-semibold text-text-primary">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-left text-sm text-text-secondary">
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div
          className={
            footer
              ? "flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pb-3"
              : "flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pb-5"
          }
        >
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col gap-2 px-4 pb-5 pt-1">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
