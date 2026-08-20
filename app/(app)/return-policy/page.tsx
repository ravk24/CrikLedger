import { redirect } from "next/navigation";

// CrikLedger sells digital software, so "Return policy" was the wrong
// document — a Shipping & Delivery Policy covers it instead. The old path
// stays so existing links keep working.
export default function ReturnPolicyRedirect() {
  redirect("/shipping-policy");
}
