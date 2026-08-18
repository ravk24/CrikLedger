import { redirect } from "next/navigation";

// CrikLedger sells digital software, so "Return policy" was the wrong
// document — Razorpay asks for a Shipping & Delivery Policy instead. The
// old path stays so existing links and any URL already given to a
// reviewer keep working.
export default function ReturnPolicyRedirect() {
  redirect("/shipping-policy");
}
