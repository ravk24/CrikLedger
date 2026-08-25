export type WizardPlayer = { id: string; name: string; is_captain?: boolean };

export type WizardGuest = {
  name: string;
  brought_car: boolean;
  shared_car: boolean;
};

export type PreviewRow = {
  player_id: string;
  brought_car: boolean;
  shared_car: boolean;
  fee: number;
};

export type GuestPreviewRow = {
  name: string;
  brought_car: boolean;
  shared_car: boolean;
  fee: number;
};

export type PreviewTotals = {
  per_player_fee: number; // the base head share
  car_share_per_sharer: number; // what each sharer (drivers included) adds on top
  sharer_count: number;
  own_way_count: number; // heads who pay only the base share
  car_count: number;
  total_cost: number; // cash + cars
  cash_costs: number; // ground + balls + other
  collected_total: number;
  surplus_to_pool: number;
  guest_rows: GuestPreviewRow[];
  captain_charge: number;
  captain_name: string | null;
};

export type WizardCosts = {
  ground: string;
  ball: string;
  other: string;
  allowance: string;
};

export type WizardInitial = {
  result: "won" | "lost";
  costs: WizardCosts;
  selected: string[];
  cars: string[];
  shared: string[];
  guests: WizardGuest[];
};

export function rowKey(row: { player_id: string }): string {
  return row.player_id;
}
