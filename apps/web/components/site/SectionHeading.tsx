interface SectionHeadingProps {
  kicker: string;
  title: string;
  align?: "left" | "center";
}

export function SectionHeading({ kicker, title, align = "center" }: SectionHeadingProps) {
  const isCenter = align === "center";
  return (
    <div className={`flex flex-col gap-2 ${isCenter ? "items-center text-center" : "items-start text-left"}`}>
      <span className="section-kicker text-xs font-bold uppercase text-gold-dim">{kicker}</span>
      <h1 className="font-display text-glow-gold text-3xl font-black text-gold-bright sm:text-4xl">{title}</h1>
      <div className={`h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent ${isCenter ? "" : "ml-0"}`} />
    </div>
  );
}
