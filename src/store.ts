import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Lang } from "./i18n";
import type { RankTier, Run } from "./types";

// Everything lives in one folder on the player's computer: the settings, the
// accumulated history and the generated page. The game API only shows the
// last ~10 runs, so a longer history exists only because we keep it here.

function defaultDataDir(): string {
  const home = os.homedir();
  if (process.platform === "win32")
    return path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "BatomonMatchHistory");
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "BatomonMatchHistory");
  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "batomon-match-history");
}

export const DATA_DIR = process.env.BMH_DATA_DIR ? path.resolve(process.env.BMH_DATA_DIR) : defaultDataDir();
export const PAGE_FILE = path.join(DATA_DIR, "index.html");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export interface Config {
  playerId: string;
  name: string;
  lang: Lang;
}

/** The profile at one moment: feeds the MMR chart. */
export interface Snapshot {
  at: string;
  rank: RankTier | null;
  mmr: number | null;
  games: number;
  wins: number;
}

export interface MyRun extends Run {
  /** MMR change of the run, when it can be attributed (see mergeSync). */
  mmrDelta: number | null;
}

export interface History {
  playerId: string;
  name: string;
  runs: MyRun[];
  snapshots: Snapshot[];
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 1) + "\n");
}

export const loadConfig = () => readJson<Config>(CONFIG_FILE);
export const saveConfig = (config: Config) => writeJson(CONFIG_FILE, config);
export const loadHistory = () => readJson<History>(HISTORY_FILE);
export const saveHistory = (history: History) => writeJson(HISTORY_FILE, history);

/**
 * Merges what came from the API into the saved history without duplicating
 * runs.
 *
 * MMR per run: the API only gives the current MMR. If exactly one new run
 * arrived since the last check and it is the most recent one, the MMR
 * difference between the two checks belongs to it.
 */
export function mergeSync(previous: History | null, playerId: string, name: string, snapshot: Snapshot, incoming: Run[]): {
  history: History;
  added: MyRun[];
} {
  const keep = previous?.playerId === playerId ? previous : null;
  const byId = new Map((keep?.runs ?? []).map((r) => [r.id, r]));
  const added: MyRun[] = [];
  for (const run of incoming) {
    if (byId.has(run.id)) continue;
    const mine: MyRun = { ...run, mmrDelta: null };
    byId.set(run.id, mine);
    added.push(mine);
  }
  const runs = [...byId.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  added.sort((a, b) => a.endedAt.localeCompare(b.endedAt));

  const last = keep?.snapshots.at(-1);
  if (added.length === 1 && runs.at(-1) === added[0] && last?.mmr != null && snapshot.mmr != null) {
    added[0].mmrDelta = snapshot.mmr - last.mmr;
    added[0].mmr = snapshot.mmr;
  }

  const changed = !last || added.length > 0 || last.mmr !== snapshot.mmr || last.games !== snapshot.games;
  const snapshots = [...(keep?.snapshots ?? []), ...(changed ? [snapshot] : [])];
  return { history: { playerId, name, runs, snapshots }, added };
}

/**
 * Merges a history.json from elsewhere (another computer, or the older
 * personal/ tracker in PedroBrock/batomonshowdown, which uses the same
 * format) into the saved one. Runs are matched by id; snapshots by time.
 */
export function mergeHistories(current: History | null, other: History): { history: History; added: number } {
  if (current && current.playerId !== other.playerId)
    throw new Error(`That file is for another account (${other.playerId}).`);
  const byId = new Map((current?.runs ?? []).map((r) => [r.id, r]));
  let added = 0;
  for (const run of other.runs)
    if (!byId.has(run.id)) {
      byId.set(run.id, { ...run, mmrDelta: run.mmrDelta ?? null });
      added++;
    }
  const snaps = new Map([...other.snapshots, ...(current?.snapshots ?? [])].map((s) => [s.at, s]));
  return {
    history: {
      playerId: other.playerId,
      name: current?.name ?? other.name,
      runs: [...byId.values()].sort((a, b) => a.endedAt.localeCompare(b.endedAt)),
      snapshots: [...snaps.values()].sort((a, b) => a.at.localeCompare(b.at)),
    },
    added,
  };
}

export function isHistory(value: unknown): value is History {
  const h = value as History;
  return Boolean(h && typeof h.playerId === "string" && Array.isArray(h.runs) && Array.isArray(h.snapshots));
}
