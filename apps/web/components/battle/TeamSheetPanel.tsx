import type { StatKey, TeamSheetMember } from "@yrud/shared";

const STAT_ABBR: Record<StatKey, string> = {
  hp: "PV",
  atk: "ATQ",
  def: "DEF",
  spa: "ATS",
  spd: "DFS",
  spe: "VIT",
};

// Only the EVs actually worth showing — a full 0/0/0/0/0/0 row for every
// mon would just be noise, and 31 is the default/competitive IV so only
// deviations from it are interesting.
function nonDefaultEntries(stats: Record<StatKey, number>, defaultValue: number) {
  return (Object.entries(stats) as [StatKey, number][]).filter(([, v]) => v !== defaultValue);
}

export function TeamSheetPanel({ sheet }: { sheet: TeamSheetMember[] }) {
  if (sheet.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-dim">Ton équipe (détails)</p>
      <div className="flex flex-col gap-1.5">
        {sheet.map((mon, i) => {
          const evs = nonDefaultEntries(mon.evs, 0);
          const ivs = nonDefaultEntries(mon.ivs, 31);
          return (
            <div key={i} className="rounded-lg border border-border bg-void-deep/40 px-2 py-1.5 text-[10px]">
              <p className="mb-0.5 truncate font-semibold text-ink">{mon.species}</p>
              <p className="truncate text-ink-muted">
                {mon.item ?? "—"} · {mon.ability ?? "—"} {mon.nature ? `· ${mon.nature}` : ""}
              </p>
              {evs.length > 0 && (
                <p className="truncate text-gold-dim">
                  EVs : {evs.map(([s, v]) => `${v} ${STAT_ABBR[s]}`).join(" / ")}
                </p>
              )}
              {ivs.length > 0 && (
                <p className="truncate text-purple">IVs : {ivs.map(([s, v]) => `${v} ${STAT_ABBR[s]}`).join(" / ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
