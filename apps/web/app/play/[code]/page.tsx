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
      <PlayClient code={code.toUpperCase()} />
    </div>
  );
}
