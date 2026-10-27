import catalog from "../assets/catalog.json";
import pkg from "../package.json";
import { MAX_WINS, RANK_TIERS, type Player, type RankTier, type Run, type RunOutcome, type Unit } from "./types";

// Reads the Batomon Showdown game API (api.batomon.app, run by berrymint).
// It is an unofficial, undocumented PocketBase API: player_profiles is public
// and holds each account's rank, MMR, games, wins and its ~10 most recent
// runs. A profile also carries the Steam ID; this app never stores it.

export const API_URL = process.env.BATOMON_API_URL ?? "https://api.batomon.app";
const USER_AGENT = `batomon-match-history/${pkg.version} (+https://github.com/PedroBrock/batomon-match-history)`;

export const PLAYER_ID = /^[a-z0-9]{15}$/;

export interface ListResponse<T> {
  items: T[];
}

export interface RawUnit {
  species_id?: string;
  level?: number;
}

export interface RawMatch {
  run_id: string;
  ended_at: number;
  is_ranked?: boolean;
  outcome?: string;
  round?: number;
  wins?: number;
  trainer_id?: string;
  team?: RawUnit[];
}

export interface RawProfile {
  owner: string;
  rank_tier?: string;
  ranked_mmr?: number;
  season_number?: number;
  user_data?: {
    display_name?: string;
    games_played?: number;
    runs_won?: number;
    match_history?: RawMatch[];
  };
}

export interface RawSeason {
  number: number;
  starts_at: string;
  ends_at: string;
}

export class ApiError extends Error {}

export function recordsUrl(collection: string, params: Record<string, string | number>): string {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]));
  return `${API_URL}/api/collections/${collection}/records?${query}`;
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  } catch (err) {
    throw new ApiError((err as Error).message);
  }
  if (res.status !== 200) throw new ApiError(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function ownerFilter(owner: string): string {
  if (!PLAYER_ID.test(owner)) throw new Error(`Invalid player ID: ${owner}`);
  return `owner='${owner}'`;
}

/**
 * Case-insensitive "contains" filter on the display name. Strips anything
 * that is not a letter, digit, space, dot, hyphen or underscore, so the text
 * cannot break out of the filter's quotes. null when too little is left.
 */
export function nameFilter(name: string, exact = false): string | null {
  const clean = name.normalize("NFC").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 32);
  return clean.length >= 3 ? `user_data.display_name${exact ? "=" : "~"}'${clean}'` : null;
}

export async function fetchProfile(owner: string): Promise<RawProfile | null> {
  const data = await getJson<ListResponse<RawProfile>>(recordsUrl("player_profiles", { perPage: 1, filter: ownerFilter(owner) }));
  return data.items[0] ?? null;
}

export async function searchProfiles(filter: string): Promise<RawProfile[]> {
  const data = await getJson<ListResponse<RawProfile>>(
    recordsUrl("player_profiles", { perPage: 10, sort: "-ranked_mmr", skipTotal: 1, filter }),
  );
  return data.items;
}

export async function fetchSeasons(): Promise<RawSeason[]> {
  const data = await getJson<ListResponse<RawSeason>>(recordsUrl("seasons", { perPage: 50, sort: "-number" }));
  return data.items;
}

// ---------------------------------------------------------------------------
// Conversion to the internal format

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// The API uses the sprite file name as species_id, which sometimes differs
// from the in-game name (alpinine is Craghorn, dragon_egg_0 is Dragon Egg).
const MONSTER_NAMES = new Map(
  Object.entries(catalog.monsters as Record<string, string>).flatMap(([name, sprite]) => [
    [squash(name), name],
    [squash(sprite.replace(/\.png$/, "")), name],
  ]),
);
const TRAINER_NAMES = new Map(Object.keys(catalog.trainers).map((name) => [squash(name), name]));
// API trainer_ids whose in-game name is different.
const TRAINER_IDS: Record<string, string> = {
  pyromaniac: "Chef",
  lady: "Rich Lady",
  youngsterf: "Lucky Girl",
  youngsterm: "Youngster",
  mysterioustrainer: "???",
};

function titleCase(id: string): string {
  return id
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Batomon name from an API species_id (or an already converted name). */
export function monsterName(speciesId: string): string {
  return MONSTER_NAMES.get(squash(speciesId)) ?? titleCase(speciesId);
}

/** Trainer name from an API trainer_id (or an already converted name). */
export function trainerName(trainerId: string): string {
  const key = squash(trainerId);
  return TRAINER_IDS[key] ?? TRAINER_NAMES.get(key) ?? titleCase(trainerId);
}

export function rankTier(raw: string | undefined): RankTier | null {
  if (!raw) return null;
  return RANK_TIERS.find((t) => t.toLowerCase() === raw.toLowerCase()) ?? null;
}

function outcomeOf(raw: string | undefined): RunOutcome | null {
  return raw === "won" || raw === "lost" || raw === "abandoned" ? raw : null;
}

function hasRealWins(match: RawMatch): boolean {
  return typeof match.wins === "number" && match.wins >= 0 && match.wins <= MAX_WINS;
}

/**
 * Badges of a run. `wins` is 0 to 10 in current runs; a few very old runs
 * have 99. Outside 0 to 10, a "won" run counts as 10 and any other run as the
 * rounds played minus the last one.
 */
export function inferWins(match: RawMatch): number {
  if (hasRealWins(match)) return match.wins as number;
  if (match.outcome === "won") return MAX_WINS;
  return Math.max(0, Math.min(MAX_WINS - 1, (match.round ?? 1) - 1));
}

/** Lost rounds: rounds played minus badges. null when unknown. */
export function inferLosses(match: RawMatch): number | null {
  if (!hasRealWins(match) || typeof match.round !== "number" || match.round < (match.wins as number)) return null;
  return match.round - (match.wins as number);
}

export function seasonAt(seasons: RawSeason[], iso: string, fallback: number): number {
  const hit = seasons.find((s) => s.starts_at.replace(" ", "T") <= iso && iso < s.ends_at.replace(" ", "T"));
  return hit?.number ?? fallback;
}

const STEAM_ID = /^7656119\d{10}$/;

/**
 * Name to show. Some profiles have their Steam ID as the name (players who
 * never picked one); those are treated as nameless so it is never shown.
 */
export function displayName(raw: string | undefined): string | null {
  const name = raw?.trim();
  return name && !STEAM_ID.test(name) ? name : null;
}

export function mapProfile(raw: RawProfile, seasons: RawSeason[]): { player: Player; runs: Run[] } {
  const data = raw.user_data ?? {};
  const rank = rankTier(raw.rank_tier);
  const season = raw.season_number ?? 0;
  const player: Player = {
    id: raw.owner,
    name: displayName(data.display_name) ?? raw.owner,
    rank,
    mmr: raw.ranked_mmr ?? null,
    games: data.games_played ?? 0,
    wins: data.runs_won ?? 0,
  };

  const runs: Run[] = [];
  for (const match of data.match_history ?? []) {
    if (match.is_ranked === false || !match.run_id || !match.ended_at) continue;
    const units: Unit[] = (match.team ?? [])
      .filter((u): u is Required<RawUnit> => Boolean(u.species_id))
      .map((u) => ({ name: monsterName(u.species_id), level: u.level ?? 1 }));
    const endedAt = new Date(match.ended_at * 1000).toISOString();
    runs.push({
      id: match.run_id,
      playerId: raw.owner,
      season: seasonAt(seasons, endedAt, season),
      trainers: match.trainer_id ? [trainerName(match.trainer_id)] : [],
      units,
      wins: inferWins(match),
      losses: inferLosses(match),
      outcome: outcomeOf(match.outcome),
      // The API has no MMR per run; store.ts fills it in when it can.
      mmr: null,
      rank,
      round: match.round ?? 0,
      endedAt,
    });
  }
  return { player, runs };
}
