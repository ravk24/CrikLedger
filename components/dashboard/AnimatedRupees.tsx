"use client";

import { useEffect } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { formatRupees } from "@/lib/format";

type Props = {
  value: number;
  className?: string;
};

// One of the two Framer Motion uses in v0 (the entire animation
// budget — library-docs). Degrades to a static number under
// prefers-reduced-motion.
export function AnimatedRupees({ value, className }: Props) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => {
    const rounded = Math.round(v);
    return `${rounded < 0 ? "−₹" : "₹"}${formatRupees(rounded)}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const color = value < 0 ? "text-debit" : "text-credit";

  if (reduced) {
    return (
      <span className={cn("tabular-nums", color, className)}>
        {value < 0 ? "−₹" : "₹"}
        {formatRupees(value)}
      </span>
    );
  }

  return (
    <motion.span className={cn("tabular-nums", color, className)}>
      {display}
    </motion.span>
  );
}
