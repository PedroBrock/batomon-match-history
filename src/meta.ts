import { clusterRuns } from "./comps";
import { rankDelta } from "./stats";
import { MAX_WINS, type Run, type Unit } from "./types";

// Meta stats: the comps tier list and per-trainer numbers of the top of the
// ranking. scripts/collect-meta.ts builds them on GitHub Actions every few
// hours and publishes meta.json; the app downloads that file, so the game API
// is read once for everyone instead of once per player.
//
// Tier method (the same as the BatoStats site): runs are grouped by a core of
// 3 Batomon (see comps.ts); each comp scores 70% share of 10-badge runs + 30%
// average badges / 10; only comps with enough runs and distinct players get a
// letter, by position: top 15% S, up to 40% A, up to 70% B, the rest C.

export const META_VERSION = 1;

export type TierLetter = "S" | "A" | "B" | "C";

export interface TrainerShare {
  name: string;
  share: number;
}

export interface MetaComp {
  key: string;
  /** The two most present core Batomon, "A + B". */
  name: string;
  core: string[];
  /** Typical final team: the 6 most present Batomon with their usual level. */
  units: Unit[];
  trainers: TrainerShare[];
  runs: number;
  players: number;
  avgWins: number;
  /** Share of runs with 10 badges. */
  tenRate: number;
  /** Share of all analyzed runs. */
  playRate: number;
  score: number;
  tier: TierLetter | null;
}

export interface MetaTrainer {
  name: string;
  runs: number;
  playRate: number;
  avgWins: number;
  tenRate: number;
  /** Share of runs with 6+ badges (rank went up). */
  upRate: number;
  /** Times offered and picked in trainer_selections (all players). */
  offered: number;
  picked: number;
  /** picked / offered, null without selection data. */
  pickRate: number | null;
}

export interface MetaStats {
  version: number;
  generatedAt: string;
  season: number;
  windowDays: number;
  /** Distinct players behind the runs. */
  players: number;
  runs: number;
  /** Trainer selections behind the pick rates. */
  selections: number;
  comps: MetaComp[];
  trainers: MetaTrainer[];
}

/** One trainer pick screen: which trainers were offered and which was taken. */
export interface Selection {
  offered: string[];
  picked: string | null;
}

export const TIER_OPTIONS = {
  minRuns: 40,
  minPlayers: 25,
  /** Fewer qualified comps than this and no letters are given. */
  minQualified: 8,
  topWeight: 0.7,
  winsWeight: 0.3,
  cutoffs: [0.15, 0.4, 0.7] as const,
};

function countBy(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

function top(counts: Map<string, number>, n: number): [string, number][] {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

const distinctUnits = (run: Run) => [...new Set(run.units.map((u) => u.name))];

function typicalTeam(runs: Run[]): Unit[] {
  const presence = countBy(runs.flatMap(distinctUnits));
  return top(presence, 6).map(([name]) => {
    const levels = countBy(runs.flatMap((r) => r.units.filter((u) => u.name === name).map((u) => String(u.level))));
    return { name, level: Number(top(levels, 1)[0]?.[0] ?? 1) };
  });
}

function assignTiers(comps: MetaComp[]): void {
  const qualified = comps
    .filter((c) => c.runs >= TIER_OPTIONS.minRuns && c.players >= TIER_OPTIONS.minPlayers)
    .sort((a, b) => b.score - a.score);
  if (qualified.length < TIER_OPTIONS.minQualified) return;
  const letters: TierLetter[] = ["S", "A", "B"];
  qualified.forEach((comp, i) => {
    const idx = TIER_OPTIONS.cutoffs.findIndex((cut) => (i + 1) / qualified.length <= cut);
    comp.tier = idx === -1 ? "C" : letters[idx];
  });
  qualified[0].tier = "S";
}

export function buildComps(runs: Run[]): MetaComp[] {
  const withTeam = runs.filter((r) => r.units.length >= 3);
  const comps: MetaComp[] = [];
  for (const [key, members] of clusterRuns(withTeam, TIER_OPTIONS.minRuns)) {
    const presence = countBy(members.flatMap(distinctUnits));
    const core = key.split("|").sort((a, b) => (presence.get(b) ?? 0) - (presence.get(a) ?? 0) || a.localeCompare(b));
    const avgWins = members.reduce((s, r) => s + r.wins, 0) / members.length;
    const tenRate = members.filter((r) => r.wins >= MAX_WINS).length / members.length;
    comps.push({
      key,
      name: `${core[0]} + ${core[1]}`,
      core,
      units: typicalTeam(members),
      trainers: top(countBy(members.flatMap((r) => [...new Set(r.trainers)])), 3).map(([name, n]) => ({
        name,
        share: n / members.length,
      })),
      runs: members.length,
      players: new Set(members.map((r) => r.playerId)).size,
      avgWins,
      tenRate,
      playRate: members.length / withTeam.length,
      score: TIER_OPTIONS.topWeight * tenRate + TIER_OPTIONS.winsWeight * (avgWins / MAX_WINS),
      tier: null,
    });
  }
  assignTiers(comps);
  const order = (c: MetaComp) => (c.tier ? "SABC".indexOf(c.tier) : 4);
  return comps.sort((a, b) => order(a) - order(b) || b.score - a.score);
}

export function buildTrainers(runs: Run[], selections: Selection[]): MetaTrainer[] {
  const byName = new Map<string, Run[]>();
  for (const run of runs)
    for (const name of new Set(run.trainers)) {
      const list = byName.get(name) ?? [];
      list.push(run);
      byName.set(name, list);
    }
  const offered = countBy(selections.flatMap((s) => [...new Set(s.offered)]));
  const picked = countBy(selections.flatMap((s) => (s.picked ? [s.picked] : [])));

  const names = new Set([...byName.keys(), ...offered.keys()]);
  return [...names]
    .map((name): MetaTrainer => {
      const list = byName.get(name) ?? [];
      const n = list.length;
      const o = offered.get(name) ?? 0;
      return {
        name,
        runs: n,
        playRate: runs.length ? n / runs.length : 0,
        avgWins: n ? list.reduce((s, r) => s + r.wins, 0) / n : 0,
        tenRate: n ? list.filter((r) => r.wins >= MAX_WINS).length / n : 0,
        upRate: n ? list.filter((r) => rankDelta(r) > 0).length / n : 0,
        offered: o,
        picked: picked.get(name) ?? 0,
        pickRate: o ? (picked.get(name) ?? 0) / o : null,
      };
    })
    .sort((a, b) => b.avgWins - a.avgWins || b.runs - a.runs);
}

/** Ranked, finished runs of the season that ended in the last windowDays. */
export function metaRuns(runs: Run[], season: number, windowDays: number, now: Date): Run[] {
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
  return runs.filter((r) => r.season === season && r.outcome !== "abandoned" && r.endedAt >= since);
}

export function buildMeta(runs: Run[], selections: Selection[], season: number, windowDays: number, now = new Date()): MetaStats {
  const recent = metaRuns(runs, season, windowDays, now);
  return {
    version: META_VERSION,
    generatedAt: now.toISOString(),
    season,
    windowDays,
    players: new Set(recent.map((r) => r.playerId)).size,
    runs: recent.length,
    selections: selections.length,
    comps: buildComps(recent),
    trainers: buildTrainers(recent, selections),
  };
}

export function isMeta(value: unknown): value is MetaStats {
  const m = value as MetaStats;
  return Boolean(m && m.version === META_VERSION && Array.isArray(m.comps) && Array.isArray(m.trainers));
}
