"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatRupees } from "@/lib/format";

type Props = {
  value: number;
  className?: string;
};

const DURATION_MS = 700;

function label(n: number) {
  return `${n < 0 ? "−₹" : "₹"}${formatRupees(n)}`;
}

// Counts up to the balance with a small requestAnimationFrame tween —
// the app's only animation, so it is not worth a library. Renders the
// final number straight away under prefers-reduced-motion and on the
// server, so the static shell never shows ₹0.
export function AnimatedRupees({ value, className }: Props) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const color = value < 0 ? "text-debit" : "text-credit";
  return (
    <span className={cn("tabular-nums", color, className)}>
      {label(shown)}
    </span>
  );
}
