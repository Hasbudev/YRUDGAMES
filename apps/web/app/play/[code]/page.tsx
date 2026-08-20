import Image from "next/image";
import { PlayClient } from "./PlayClient";

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 sm:p-10">
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Image src="/play/bg.png" alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-void-deep/40 via-void-deep/60 to-void-deep/95" />
      </div>
      <div className="relative w-full max-w-lg">
        <Image src="/play/header-bar.png" alt="" width={1415} height={185} className="h-auto w-full" priority />
        <span
          className="absolute flex items-center justify-center overflow-hidden font-display text-xs font-bold leading-none tracking-[0.02em] text-gold-bright sm:text-sm"
          style={{ left: "73.5%", right: "14%", top: "58%", bottom: "25%" }}
        >
          {code.toUpperCase()}
        </span>
      </div>
      <PlayClient code={code.toUpperCase()} />
    </div>
  );
}
