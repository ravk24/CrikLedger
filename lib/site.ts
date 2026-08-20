// The public address of the app, in one place.
//
// Printed on the shared match-sheet PNG so a WhatsApp group that gets
// forwarded the image can find the app. Kept as a bare host (no scheme)
// because it is read by people, not fetched — prefix it with https://
// when a link is needed.
export const SITE_HOST = "crik-ledger.vercel.app";
export const SITE_URL = `https://${SITE_HOST}`;
