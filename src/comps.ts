import type { Run } from "./types";

// Groups runs into archetypes defined by a "core" of 3 Batomon (the same
// method as the BatoStats tier list): the core present in the most
// unassigned runs becomes an archetype, its runs leave the pool, and this
// repeats until no core has the minimum support.

function triples(names: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      for (let k = j + 1; k < names.length; k++) out.push([names[i], names[j], names[k]].join("|"));
  return out;
}

export function clusterRuns(runs: Run[], minSupport: number): Map<string, Run[]> {
  const keysByRun = runs.map((run) => triples([...new Set(run.units.map((u) => u.name))].sort()));
  const remaining = new Set(runs.map((_, i) => i));
  const clusters = new Map<string, Run[]>();

  while (remaining.size > 0) {
    const support = new Map<string, number>();
    for (const i of remaining) for (const key of keysByRun[i]) support.set(key, (support.get(key) ?? 0) + 1);

    const [best] = [...support].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!best || best[1] < minSupport) break;

    const members: Run[] = [];
    for (const i of [...remaining])
      if (keysByRun[i].includes(best[0])) {
        members.push(runs[i]);
        remaining.delete(i);
      }
    clusters.set(best[0], members);
  }
  return clusters;
}
