import { clusterRuns } from "./comps";
import { MAX_WINS, type Run, type Unit } from "./types";

// Ranked rules: a run ends at 10 badges or 0 lives, and the rank changes by
// badges - 5 (5 keeps it, 6 is +1, 4 is -1).

/** Badges that leave the rank unchanged. */
export const NEUTRAL_WINS = 5;
/** Minimum runs for a group (comp, Batomon) to show up in the tables. */
export const MIN_GROUP_RUNS = 2;
/** How many comps "worst comps" shows. */
export const WORST_COMPS = 5;
/** Key of the catch-all comp for teams that did not repeat. */
export const OTHER_COMPS = "others";

export interface Line {
  key: string;
  label: string;
  /** Example team (comps) or the unit itself (Batomon). */
  units: Unit[];
  runs: number;
  /** Share of runs with 10 badges. */
  tenRate: number;
  avgWins: number;
  /** Share of runs that ranked up (6+ badges). */
  upRate: number;
  /** Sum of (badges - 5): how much rank the group gave or took. */
  rankNet: number;
  /** Rounds won / rounds played, when losses are known. */
  roundWinRate: number | null;
}

export interface DayLine {
  day: string;
  runs: number;
  avgWins: number;
  rankNet: number;
}

export interface PersonalStats {
  total: Line;
  abandoned: number;
  last20: Line | null;
  byTrainer: Line[];
  byComp: Line[];
  /** Comps with the lowest average badges (up to WORST_COMPS). */
  worstComps: Line[];
  byMonster: Line[];
  byDay: DayLine[];
}

export const rankDelta = (run: Run) => run.wins - NEUTRAL_WINS;

export function line(key: string, label: string, units: Unit[], runs: Run[]): Line {
  const n = runs.length;
  const sum = (f: (r: Run) => number) => runs.reduce((s, r) => s + f(r), 0);
  const withLosses = runs.filter((r) => r.losses !== null);
  const rounds = withLosses.reduce((s, r) => s + r.wins + (r.losses as number), 0);
  return {
    key,
    label,
    units,
    runs: n,
    tenRate: n ? runs.filter((r) => r.wins >= MAX_WINS).length / n : 0,
    avgWins: n ? sum((r) => r.wins) / n : 0,
    upRate: n ? runs.filter((r) => r.wins > NEUTRAL_WINS).length / n : 0,
    rankNet: sum(rankDelta),
    roundWinRate: rounds ? withLosses.reduce((s, r) => s + r.wins, 0) / rounds : null,
  };
}

function groupBy(runs: Run[], keys: (r: Run) => string[]): Map<string, Run[]> {
  const out = new Map<string, Run[]>();
  for (const run of runs)
    for (const k of new Set(keys(run))) {
      const list = out.get(k) ?? [];
      list.push(run);
      out.set(k, list);
    }
  return out;
}

const byRunsThenNet = (a: Line, b: Line) => b.runs - a.runs || b.rankNet - a.rankNet;

/** Example team: the final team of the group's most recent run. */
function exampleTeam(runs: Run[]): Unit[] {
  return [...runs].sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0]?.units ?? [];
}

export function computeStats(allRuns: Run[]): PersonalStats {
  // Abandoned runs say nothing about the comp; they only count in the total.
  const runs = allRuns.filter((r) => r.outcome !== "abandoned").sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  const abandoned = allRuns.length - runs.length;

  const byTrainer = [...groupBy(runs, (r) => r.trainers)].map(([name, list]) => line(name, name, [], list)).sort(byRunsThenNet);

  // Comps: 3-Batomon archetypes with a small minimum sample. Anything that
  // falls in none of them goes to "others".
  const withTeam = runs.filter((r) => r.units.length >= 3);
  const clusters = clusterRuns(withTeam, MIN_GROUP_RUNS);
  const clustered = new Set([...clusters.values()].flat());
  const byComp = [...clusters].map(([key, list]) => {
    const presence = groupBy(list, (r) => r.units.map((u) => u.name));
    const core = key.split("|").sort((a, b) => (presence.get(b)?.length ?? 0) - (presence.get(a)?.length ?? 0) || a.localeCompare(b));
    return line(key, core.join(" + "), exampleTeam(list), list);
  });
  const others = withTeam.filter((r) => !clustered.has(r));
  if (others.length) byComp.push(line(OTHER_COMPS, OTHER_COMPS, [], others));
  byComp.sort(byRunsThenNet);

  const worstComps = byComp
    .filter((c) => c.key !== OTHER_COMPS)
    .sort((a, b) => a.avgWins - b.avgWins || a.rankNet - b.rankNet)
    .slice(0, WORST_COMPS);

  const byMonster = [...groupBy(runs, (r) => r.units.map((u) => u.name))]
    .filter(([, list]) => list.length >= MIN_GROUP_RUNS)
    .map(([name, list]) => line(name, name, [{ name, level: 1 }], list))
    .sort(byRunsThenNet);

  const byDay = [...groupBy(runs, (r) => [localDay(r.endedAt)])]
    .map(([day, list]) => {
      const l = line(day, day, [], list);
      return { day, runs: l.runs, avgWins: l.avgWins, rankNet: l.rankNet };
    })
    .sort((a, b) => b.day.localeCompare(a.day));

  return {
    total: line("total", "total", [], runs),
    abandoned,
    last20: runs.length > 20 ? line("last20", "last20", [], runs.slice(-20)) : null,
    byTrainer,
    byComp,
    worstComps,
    byMonster,
    byDay,
  };
}

/** Date in the local time zone (YYYY-MM-DD). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
