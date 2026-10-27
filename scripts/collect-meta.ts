import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchRankingPage, fetchSeasons, fetchSelectionsPage, mapProfile, mapSelection, type RawSelection } from "../src/api";
import { buildMeta, metaRuns, type Selection } from "../src/meta";
import type { Run } from "../src/types";

// Builds meta.json (comps tier list and trainer stats) from the top of the
// ranking. Runs on GitHub Actions every 6 hours (.github/workflows/meta.yml):
//
//   npm run meta:collect -- <out dir> [state file]
//
// The game API only shows each player's last ~10 runs, so the runs seen are
// kept in the state file (an Actions cache, never published) and merged with
// the next collection. Only the aggregated meta.json is published.

const TOP_PLAYERS = Number(process.env.META_TOP_PLAYERS ?? 2000);
const PER_PAGE = 200;
const WINDOW_DAYS = Number(process.env.META_WINDOW_DAYS ?? 14);
/** Newest trainer_selections pages to read (500 records each). */
const SELECTION_PAGES = Number(process.env.META_SELECTION_PAGES ?? 20);
const SELECTIONS_PER_PAGE = 500;
const DELAY_MS = 1000;

interface State {
  season: number;
  runs: Run[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readState(file: string | undefined): Promise<State | null> {
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, "utf8")) as State;
  } catch {
    return null;
  }
}

function countValues(items: RawSelection[], key: keyof RawSelection): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(String(item[key]), (counts.get(String(item[key])) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([v, n]) => `${v}=${n}`)
    .join("  ");
}

/** The newest trainer selections, limited to ranked and to the latest game version when there are enough. */
async function collectSelections(): Promise<Selection[]> {
  const first = await fetchSelectionsPage(1, SELECTIONS_PER_PAGE);
  const raw: RawSelection[] = [];
  const from = Math.max(1, first.totalPages - SELECTION_PAGES + 1);
  for (let page = first.totalPages; page >= from; page--) {
    await sleep(DELAY_MS);
    raw.push(...(page === 1 ? first.items : (await fetchSelectionsPage(page, SELECTIONS_PER_PAGE)).items));
  }
  console.log(`trainer_selections: ${raw.length} of ~${first.totalPages * SELECTIONS_PER_PAGE} records`);
  console.log(`  mode: ${countValues(raw, "mode")}`);
  console.log(`  version: ${countValues(raw, "version")}`);
  if (raw[0]) console.log(`  sample: ${JSON.stringify({ offered: raw[0].offered_trainers, picked: raw[0].picked_trainer })}`);

  let pool = raw;
  const ranked = pool.filter((s) => String(s.mode).toLowerCase() === "ranked");
  if (ranked.length) pool = ranked;
  // The last page holds the newest records, and raw starts with it.
  const latest = pool[0]?.version;
  const sameVersion = pool.filter((s) => s.version === latest);
  if (latest && sameVersion.length >= 2000) pool = sameVersion;
  return pool.map(mapSelection).filter((s) => s.offered.length > 0);
}

async function main(): Promise<void> {
  const [outDir = "meta-out", stateFile] = process.argv.slice(2);
  const now = new Date();
  const seasons = await fetchSeasons();
  const season = (seasons.find((s) => s.status === "active") ?? seasons[0])?.number ?? 1;
  console.log(`Season ${season}, top ${TOP_PLAYERS} players, last ${WINDOW_DAYS} days.`);

  const fresh: Run[] = [];
  let players = 0;
  for (let page = 1; players < TOP_PLAYERS; page++) {
    if (page > 1) await sleep(DELAY_MS);
    const items = await fetchRankingPage(page, PER_PAGE, `season_number=${season}`);
    for (const profile of items.slice(0, TOP_PLAYERS - players)) fresh.push(...mapProfile(profile, seasons).runs);
    players += items.length;
    if (items.length < PER_PAGE) break;
  }
  console.log(`player_profiles: ${players} players, ${fresh.length} ranked runs`);

  const previous = await readState(stateFile);
  const byId = new Map((previous?.season === season ? previous.runs : []).map((r) => [r.id, r]));
  for (const run of fresh) byId.set(run.id, run);
  const runs = metaRuns([...byId.values()], season, WINDOW_DAYS, now);
  console.log(`Runs kept: ${runs.length} (${runs.length - fresh.length} from earlier collections)`);

  const meta = buildMeta(runs, await collectSelections(), season, WINDOW_DAYS, now);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta));
  if (stateFile) {
    await mkdir(path.dirname(stateFile), { recursive: true });
    await writeFile(stateFile, JSON.stringify({ season, runs } satisfies State));
  }
  const tiers = meta.comps.filter((c) => c.tier).map((c) => `${c.tier} ${c.name}`);
  console.log(`meta.json: ${meta.comps.length} comps (${tiers.length} with a tier), ${meta.trainers.length} trainers`);
  for (const line of tiers.slice(0, 10)) console.log(`  ${line}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
