import Image from "next/image";

export function YrudPortrait({ size = "lg" }: { size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "h-40 w-40" : "h-14 w-14";
  return (
    <div
      className={`${dims} relative shrink-0 overflow-hidden rounded-full border-4 border-gold bg-void-deep shadow-[0_0_30px_rgba(232,193,90,0.4)]`}
    >
      <Image
        src="/art/yrud.png"
        alt="Yrud"
        fill
        sizes={size === "lg" ? "160px" : "56px"}
        className="object-cover object-top scale-[1.7] translate-y-[8%]"
      />
    </div>
  );
}
