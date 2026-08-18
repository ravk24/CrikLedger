"use client";

import { useState } from "react";
import { carFee } from "@/engine/carFee";
import { Money } from "@/components/shared/Money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CarFeeCalculator() {
  const [raw, setRaw] = useState("");

  const distance = Number(raw);
  const valid = raw.trim() !== "" && Number.isFinite(distance) && distance >= 0;

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <Label htmlFor="car-fee-distance">Enter exact distance</Label>
        <div className="flex items-center gap-2">
          <Input
            id="car-fee-distance"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="h-11"
          />
          <span className="text-sm text-text-muted">km</span>
        </div>
        {!valid && (
          <p className="text-xs text-text-muted">
            Enter the Google Maps distance to see the car allowance.
          </p>
        )}
      </div>
      {valid && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-bold text-text-primary">Car allowance</p>
          <Money
            amount={carFee(distance)}
            variant="balance"
            className="text-2xl font-bold"
          />
        </div>
      )}
    </>
  );
}
