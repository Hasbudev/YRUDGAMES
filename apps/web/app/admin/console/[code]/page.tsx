import Image from "next/image";
import { ConsoleClient } from "./ConsoleClient";

export default async function AdminConsolePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 sm:p-10">
      <div className="flex items-center gap-2">
        <Image src="/art/Logo_RPPLF.png" alt="" width={28} height={28} />
        <h1 className="font-display text-sm font-bold tracking-widest text-gold-bright uppercase">
          Console de Yrud — {code.toUpperCase()}
        </h1>
      </div>
      <ConsoleClient code={code.toUpperCase()} />
    </div>
  );
}
