import Image from "next/image";

export function TurnIndicator({ turn }: { turn: number }) {
  return (
    <div className="relative w-40 sm:w-52">
      <Image src="/fight/turn-banner.png" alt="" width={259} height={62} className="h-auto w-full" />
      <span
        className="absolute flex items-center justify-center font-display text-sm font-black text-gold-bright sm:text-base"
        style={{ left: "58%", right: "8%", top: "8%", bottom: "38%" }}
      >
        {turn}
      </span>
    </div>
  );
}
