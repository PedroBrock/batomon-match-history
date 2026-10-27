// Internal format. src/api.ts converts what the game API returns into these
// types, so the rest of the app does not depend on the API's (undocumented)
// schema.

export const RANK_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"] as const;
export type RankTier = (typeof RANK_TIERS)[number];

/** Badges (round wins) that end a run as champion. */
export const MAX_WINS = 10;

export interface Unit {
  name: string;
  /** Unit level/stars in the final team (1 to 3). */
  level: number;
}

export type RunOutcome = "won" | "lost" | "abandoned";

/** A finished ranked run with the player's final team. */
export interface Run {
  id: string;
  playerId: string;
  season: number;
  trainers: string[];
  units: Unit[];
  /** Badges earned (0 to 10). */
  wins: number;
  /** null when it cannot be worked out. */
  losses: number | null;
  outcome: RunOutcome | null;
  /** MMR right after the run, when known. */
  mmr: number | null;
  rank: RankTier | null;
  /** Round the run ended on. */
  round: number;
  /** ISO 8601. */
  endedAt: string;
}

export interface Player {
  /** Public in-game player ID (15 characters, not the Steam ID). */
  id: string;
  name: string;
  rank: RankTier | null;
  mmr: number | null;
  games: number;
  wins: number;
}
