import Image from "next/image";

const CORNERS = [
  { src: "/play/corner-tl.png", position: "-left-3 -top-3 sm:-left-4 sm:-top-4" },
  { src: "/play/corner-tr.png", position: "-right-3 -top-3 sm:-right-4 sm:-top-4" },
  { src: "/play/corner-bl.png", position: "-left-3 -bottom-3 sm:-left-4 sm:-bottom-4" },
  { src: "/play/corner-br.png", position: "-right-3 -bottom-3 sm:-right-4 sm:-bottom-4" },
];

interface OrnatePanelProps {
  children: React.ReactNode;
  className?: string;
  innerRef?: React.Ref<HTMLDivElement>;
}

export function OrnatePanel({ children, className = "", innerRef }: OrnatePanelProps) {
  return (
    <div
      ref={innerRef}
      className={`relative overflow-visible rounded-2xl border border-gold/40 bg-gradient-to-b from-[#241a3d] via-[#1a1330] to-[#140f26] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(232,193,90,0.15)] sm:p-8 ${className}`}
    >
      {CORNERS.map((c) => (
        <Image
          key={c.src + c.position}
          src={c.src}
          alt=""
          width={64}
          height={64}
          className={`pointer-events-none absolute z-10 h-12 w-12 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] sm:h-14 sm:w-14 ${c.position}`}
        />
      ))}
      <div className="relative z-0">{children}</div>
    </div>
  );
}
