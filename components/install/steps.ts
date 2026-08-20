// Install copy, split out of the component so the step text and the
// diagram that illustrates it stay next to each other and cannot drift.
// Plain data, no JSX — imported by both the server page and the client
// guide.

export type Platform = "android" | "ios";

export type InstallStepId =
  | "android-open"
  | "android-menu"
  | "android-confirm"
  | "android-done"
  | "ios-open"
  | "ios-share"
  | "ios-confirm"
  | "ios-done";

export type InstallStep = {
  id: InstallStepId;
  title: string;
  body: string;
  /** What the drawing shows — not a repeat of `body`. */
  alt: string;
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
};

const ANDROID: InstallStep[] = [
  {
    id: "android-open",
    title: "Open CrikLedger in Chrome",
    body: "You are already on CrikLedger — just make sure you are in Chrome, not another browser. Tap the ⋮ menu button at the top right.",
    alt: "A phone showing CrikLedger in Chrome, with the three-dot menu button at the top right circled.",
  },
  {
    id: "android-menu",
    title: "Tap “Add to Home screen”",
    body: "In the menu, look for “Add to Home screen” — on some versions of Chrome it reads “Install app”. Tap it.",
    alt: "The Chrome menu open, with the “Add to Home screen” row highlighted.",
  },
  {
    id: "android-confirm",
    title: "Confirm with “Install”",
    body: "Chrome shows the CrikLedger icon and name. Tap Install (or Add) to confirm.",
    alt: "An install dialog showing the CrikLedger icon and an Install button.",
  },
  {
    id: "android-done",
    title: "Open it from your home screen",
    body: "CrikLedger now sits on your home screen with its own icon and opens full screen, without the browser bars.",
    alt: "A home screen with the CrikLedger icon among the other app icons.",
  },
];

const IOS: InstallStep[] = [
  {
    id: "ios-open",
    title: "Open CrikLedger in Safari",
    body: "Open CrikLedger in Safari, then tap the Share button in the bar at the bottom. This only works in Safari — Chrome and other browsers on iPhone cannot add apps to the home screen.",
    alt: "A phone showing CrikLedger in Safari, with the Share button in the bottom bar circled.",
  },
  {
    id: "ios-share",
    title: "Tap “Add to Home Screen”",
    body: "Scroll down the share sheet until you see “Add to Home Screen”, then tap it.",
    alt: "The iOS share sheet open, with the “Add to Home Screen” row highlighted.",
  },
  {
    id: "ios-confirm",
    title: "Tap “Add”",
    body: "Check the name, then tap Add at the top right.",
    alt: "The Add to Home Screen panel showing the CrikLedger icon and name, with the Add button at the top right highlighted.",
  },
  {
    id: "ios-done",
    title: "Open it from your home screen",
    body: "CrikLedger now sits on your home screen with its own icon and opens full screen, without the Safari bars.",
    alt: "A home screen with the CrikLedger icon among the other app icons.",
  },
];

export const INSTALL_STEPS: Record<Platform, InstallStep[]> = {
  android: ANDROID,
  ios: IOS,
};
