import type { Run } from "./types";

// Regions. Before a run the player picks Pantra or Jinto, and each region has
// its own Batomon pool, with some Batomon in both. The game API does not
// record the region of a run, so it is worked out from the final team: the
// region whose exclusive Batomon are in it.
//
// Which Batomon are exclusive comes from the runs themselves: Batomon of
// different regions (almost) never end up in the same team. The lists below
// were found that way in the runs of the top players (October 2026) and seed
// learnRegions, which redoes the split on each collection, so Batomon added
// in later patches get a region too.

export const REGIONS = ["Pantra", "Jinto"] as const;
export type Region = (typeof REGIONS)[number];

export type RegionPools = Record<Region, string[]>;

export const SEED_POOLS: RegionPools = {
  Pantra: [
    "Aegistruct", "Aristobat", "Aster", "Bambudo", "Berroon", "Blazewing", "Blixie", "Brawlmantis", "Bumblebolt",
    "Cherubble", "Cicadence", "Cinderfly", "Clawnetic", "Coalem", "Cobrex", "Craghorn", "Dirgefin", "Dribblet",
    "Dryadell", "Electranade", "Emperooze", "Formiqueen", "Frizzly", "Fumungus", "Gaiadrasil", "Galvanine",
    "Geminiss", "Guardiant", "Humbolt", "Ironcore", "Joltail", "Lignite", "Magmalith", "Magmite", "Mosslug",
    "Noxalith", "Noxnimbus", "Panbud", "Pebbler", "Plunderbird", "Prismagon", "Puffloon", "Pylong", "Pyronade",
    "Reapra", "Runerock", "Scorchimp", "Shelldra", "Sirenade", "Spinarai", "Stalagrove", "Stellagon", "Stingarde",
    "Sunsage", "Thorntail", "Torrantler", "Velocect", "Venopuff", "Zephyrex",
  ],
  Jinto: [
    "Aviarab", "Beetbud", "Beetdown", "Blessom", "Bonshell", "Brimtoad", "Bunchop", "Cairnage", "Cawnushi",
    "Cinnabark", "Cordycant", "Danuki", "Dewlotl", "Dollhime", "Drumire", "Emberpaw", "Emburn", "Fernfowl",
    "Frillet", "Furnadon", "Gachapod", "Gemwing", "Ginsage", "Kappow", "Kickrane", "Kindlepot", "Lamplet",
    "Leafleap", "Lumijel", "Mallogre", "Miasmaw", "Nekoffin", "Ninflora", "Oniclaw", "Opalion", "Orcana",
    "Ouroblaze", "Pawsperity", "Petrirex", "Pipskull", "Pompummel", "Pyrokami", "Quillustrous", "Ratacomb",
    "Rattleghast", "Rhizuka", "Rubbin", "Sarudo", "Scorubble", "Shellter", "Shikitsune", "Shrinell", "Snapscald",
    "Sproach", "Sproutquill", "Steamscuttle", "Sukoi", "Swoonet", "Tengusto", "Toximoth", "Tsunamere", "Vengrieve",
    "Vipair",
  ],
};

/** A Batomon is exclusive to a region when at least this share of its runs are in that region. */
const EXCLUSIVE_SHARE = 0.9;
/** Runs it needs before it is classified at all. */
const MIN_RUNS = 10;

function poolSets(pools: RegionPools): Record<Region, Set<string>> {
  return { Pantra: new Set(pools.Pantra), Jinto: new Set(pools.Jinto) };
}

/** The region with more of its exclusive Batomon in the team; null on a tie (or none). */
export function runRegion(run: Run, pools: RegionPools | Record<Region, Set<string>>): Region | null {
  const sets = Array.isArray(pools.Pantra) ? poolSets(pools as RegionPools) : (pools as Record<Region, Set<string>>);
  const names = new Set(run.units.map((u) => u.name));
  let pantra = 0;
  let jinto = 0;
  for (const name of names) {
    if (sets.Pantra.has(name)) pantra++;
    if (sets.Jinto.has(name)) jinto++;
  }
  return pantra > jinto ? "Pantra" : jinto > pantra ? "Jinto" : null;
}

/**
 * Redoes the split from the runs: each Batomon goes to the region of the
 * teams it shows up in (judged by the other Batomon in them), or to neither
 * when it shows up in both. Repeats until nothing moves.
 */
export function learnRegions(runs: Run[], seeds: RegionPools = SEED_POOLS): RegionPools {
  const teams = runs.map((r) => [...new Set(r.units.map((u) => u.name))]).filter((t) => t.length > 1);
  let pools = poolSets(seeds);
  for (let round = 0; round < 10; round++) {
    const votes = new Map<string, [number, number]>();
    for (const team of teams)
      for (const name of team) {
        let pantra = 0;
        let jinto = 0;
        for (const other of team) {
          if (other === name) continue;
          if (pools.Pantra.has(other)) pantra++;
          if (pools.Jinto.has(other)) jinto++;
        }
        if (pantra === jinto) continue;
        const v = votes.get(name) ?? [0, 0];
        v[pantra > jinto ? 0 : 1]++;
        votes.set(name, v);
      }
    const next: Record<Region, Set<string>> = { Pantra: new Set(), Jinto: new Set() };
    for (const [name, [pantra, jinto]] of votes) {
      const total = pantra + jinto;
      if (total < MIN_RUNS) {
        // Too rare to judge: keep what the seeds say.
        if (pools.Pantra.has(name)) next.Pantra.add(name);
        if (pools.Jinto.has(name)) next.Jinto.add(name);
      } else if (pantra / total >= EXCLUSIVE_SHARE) next.Pantra.add(name);
      else if (jinto / total >= EXCLUSIVE_SHARE) next.Jinto.add(name);
    }
    for (const region of REGIONS) for (const name of pools[region]) if (!votes.has(name)) next[region].add(name);
    const same = REGIONS.every((r) => next[r].size === pools[r].size && [...next[r]].every((n) => pools[r].has(n)));
    pools = next;
    if (same) break;
  }
  return { Pantra: [...pools.Pantra].sort(), Jinto: [...pools.Jinto].sort() };
}
