export type WizardPlayer = { id: string; name: string; is_captain?: boolean };

export type WizardGuest = { name: string; brought_car: boolean };

export type PreviewRow = {
  player_id: string;
  brought_car: boolean;
  fee: number;
};

export type GuestPreviewRow = {
  name: string;
  brought_car: boolean;
  fee: number;
};

export type PreviewTotals = {
  per_player_fee: number;
  total_cost: number;
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
  guests: WizardGuest[];
  fees: Record<string, number>; // key: player_id
};

export function rowKey(row: { player_id: string }): string {
  return row.player_id;
}
