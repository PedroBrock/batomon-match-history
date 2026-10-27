import { mkdir, writeFile } from "node:fs/promises";
import { fetchProfile, fetchSeasons, mapProfile, type RawSeason } from "./api";
import { TEXTS, type Lang } from "./i18n";
import { renderReport } from "./report";
import { computeStats } from "./stats";
import { DATA_DIR, PAGE_FILE, loadHistory, mergeSync, saveHistory, type Config, type History, type MyRun, type Snapshot } from "./store";

// One check of the player's profile: fetches the last runs, merges the new
// ones into the saved history and rebuilds the static page (index.html).
// Used by the app every few minutes while it is open, and by `sync`.

export interface SyncResult {
  history: History;
  added: MyRun[];
}

export async function writePage(history: History, lang: Lang): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PAGE_FILE, renderReport(history, computeStats(history.runs), lang));
}

// Seasons change rarely; the app checks every few minutes, so keep them a while.
let seasons: { at: number; list: RawSeason[] } | null = null;

async function cachedSeasons(): Promise<RawSeason[]> {
  if (!seasons || Date.now() - seasons.at > 3_600_000) seasons = { at: Date.now(), list: await fetchSeasons() };
  return seasons.list;
}

export async function syncHistory(config: Config): Promise<SyncResult> {
  const raw = await fetchProfile(config.playerId);
  if (!raw) throw new Error(TEXTS[config.lang].profileGone(config.playerId));
  const { player, runs } = mapProfile(raw, await cachedSeasons());
  const snapshot: Snapshot = { at: new Date().toISOString(), rank: player.rank, mmr: player.mmr, games: player.games, wins: player.wins };
  const result = mergeSync(await loadHistory(), player.id, player.name, snapshot, runs);
  await saveHistory(result.history);
  await writePage(result.history, config.lang);
  return result;
}
