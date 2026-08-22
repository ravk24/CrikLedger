// Shared class recipes for the navy chrome, so the app header and every
// detail page's own sticky header cannot drift apart.
export const CHROME_HEADER =
  "sticky top-0 z-10 border-b border-chrome-border bg-chrome text-chrome-foreground";

export const CHROME_BAR =
  "fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-chrome-border bg-chrome";

export const CHROME_BACK_LINK =
  "flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-chrome-muted hover:text-chrome-foreground";

export const CHROME_TAB =
  "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2";

// Every tab icon sits in the same padded pill so the bar height never
// depends on which tab is active; only the active one paints the pill.
export const CHROME_TAB_ICON = "flex rounded-full px-4 py-0.5";
export const CHROME_TAB_ICON_ACTIVE = "bg-chrome-elevated";
