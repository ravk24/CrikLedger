// The paid features, in one place.
//
// The catalogue used to be copy-pasted into /pricing and /purchases with
// comments asking future editors to keep them in step — a second copy of
// a PRICE is how a price gets stated wrong somewhere. /pricing is the
// only surface rendering these now (Home links to it rather than
// repeating the cards). Prices here must still match the Terms page's
// section 2 until Feature 3's products table becomes the source of truth.
//
// `refund` is deliberately part of the product rather than page copy:
// the two features have DIFFERENT refund terms, so any surface showing a
// product shows that product's terms with it.

export type Product = {
  key: "team_ledger" | "tournament_credit";
  name: string;
  price: string; // display form — keep in step with priceInr
  priceInr: number; // what the operator console records per grant
  tagline: string;
  features: string[];
  note: string;
  refund: string;
  refundable: boolean;
};

export const PRODUCTS: Product[] = [
  {
    key: "team_ledger",
    name: "Ledger",
    price: "₹99",
    priceInr: 99,
    tagline: "One-time purchase · one team",
    features: [
      "Maintain your team ledger",
      "Add players",
      "Record matches and expenses",
      "Record player contributions",
      "Track payments",
      "Calculate player balances",
      "Identify amounts owed or surplus balances",
      "Maintain the team's running financial record",
    ],
    note: "One purchase provides access for one team. The same account may be reused, but another team requires another Ledger purchase.",
    refund:
      "Refundable within 30 days of purchase, subject to the cancellation & refund policy.",
    refundable: true,
  },
  {
    key: "tournament_credit",
    name: "Tournament",
    price: "₹29",
    priceInr: 29,
    tagline: "One-time purchase · one tournament",
    features: [
      "Create a tournament",
      "Add your team",
      "Schedule matches",
      "Record match results",
      "Track player contributions",
      "Track amounts owed or surplus amounts",
    ],
    note: "The Tournament feature is designed for financial management and does not provide tournament standings or rankings.",
    refund: "The Tournament feature is not refundable.",
    refundable: false,
  },
];

export const LEDGER = PRODUCTS[0];
export const TOURNAMENT = PRODUCTS[1];
