interface HPBarProps {
  hpPercent: number;
  size?: "sm" | "md";
}

export function HPBar({ hpPercent, size = "md" }: HPBarProps) {
  const tone = hpPercent > 50 ? "bg-emerald-400" : hpPercent > 20 ? "bg-amber-400" : "bg-crimson-bright";
  const height = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={`w-full overflow-hidden rounded-full border border-black/40 bg-void-deep ${height}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-[400ms] ease-out ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
      />
    </div>
  );
}
