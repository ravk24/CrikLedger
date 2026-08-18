import { VirtualFeeCalculator } from "@/components/more/VirtualFeeCalculator";

export default function VirtualFee() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          Virtual Match Fee
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Just for fun after the match — who <em>should</em> have paid what,
          by balls actually played. Nothing is saved.
        </p>
      </div>
      <VirtualFeeCalculator />
    </>
  );
}
