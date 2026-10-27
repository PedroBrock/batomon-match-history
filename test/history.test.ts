import assert from "node:assert/strict";
import { test } from "node:test";
import { mapProfile, nameFilter, type RawProfile } from "../src/api";
import { renderReport } from "../src/report";
import { computeStats } from "../src/stats";
import { mergeHistories, mergeSync, type History, type Snapshot } from "../src/store";
import type { Run } from "../src/types";

const ME = "abcdefghij12345";

function run(id: string, endedAt: string, wins: number, units: string[], extra: Partial<Run> = {}): Run {
  return {
    id,
    playerId: ME,
    season: 1,
    trainers: ["Gamer"],
    units: units.map((name) => ({ name, level: 3 })),
    wins,
    losses: 5,
    outcome: wins >= 10 ? "won" : "lost",
    mmr: null,
    rank: "Master",
    round: wins + 5,
    endedAt,
    ...extra,
  };
}

const snap = (at: string, mmr: number, games: number): Snapshot => ({ at, rank: "Master", mmr, games, wins: 0 });

test("mergeSync keeps runs without duplicates and attributes MMR when a single run arrives", () => {
  const a = run("a", "2026-10-20T10:00:00Z", 6, ["Dracana", "Opalion", "Boomagon"]);
  const b = run("b", "2026-10-20T11:00:00Z", 3, ["Dracana", "Opalion", "Boomagon"]);
  const first = mergeSync(null, ME, "Me", snap("2026-10-20T10:05:00Z", 3000, 1), [a]);
  assert.equal(first.added.length, 1);
  assert.equal(first.added[0].mmrDelta, null, "no earlier check, so unknown");

  const second = mergeSync(first.history, ME, "Me", snap("2026-10-20T11:05:00Z", 2960, 2), [b, a]);
  assert.deepEqual(second.history.runs.map((r) => r.id), ["a", "b"]);
  assert.equal(second.added[0].mmrDelta, -40);
  assert.equal(second.history.snapshots.length, 2);

  const same = mergeSync(second.history, ME, "Me", snap("2026-10-20T11:10:00Z", 2960, 2), [b, a]);
  assert.equal(same.added.length, 0);
  assert.equal(same.history.snapshots.length, 2, "a check with no change adds no point");
});

test("mergeSync does not attribute MMR when several runs arrive at once", () => {
  const first = mergeSync(null, ME, "Me", snap("2026-10-20T10:00:00Z", 3000, 0), []);
  const runs = [run("a", "2026-10-20T10:10:00Z", 6, []), run("b", "2026-10-20T10:20:00Z", 7, [])];
  const { added } = mergeSync(first.history, ME, "Me", snap("2026-10-20T10:30:00Z", 3050, 2), runs);
  assert.deepEqual(added.map((r) => r.mmrDelta), [null, null]);
});

test("mergeHistories imports runs from another history.json of the same account", () => {
  const old: History = {
    playerId: ME,
    name: "Me",
    runs: [{ ...run("a", "2026-10-20T10:00:00Z", 6, []), mmrDelta: 21 }],
    snapshots: [snap("2026-10-20T10:05:00Z", 3000, 1)],
  };
  const current: History = {
    playerId: ME,
    name: "Me",
    runs: [{ ...run("b", "2026-10-21T10:00:00Z", 4, []), mmrDelta: null }],
    snapshots: [snap("2026-10-21T10:05:00Z", 2990, 2)],
  };
  const { history, added } = mergeHistories(current, old);
  assert.equal(added, 1);
  assert.deepEqual(history.runs.map((r) => r.id), ["a", "b"]);
  assert.equal(history.runs[0].mmrDelta, 21);
  assert.equal(history.snapshots.length, 2);
  assert.throws(() => mergeHistories(current, { ...old, playerId: "zzzzzzzzzzzzzzz" }));
});

test("computeStats works out the rank balance and sorts the worst comps", () => {
  const water = ["Lumijel", "Swoonet", "Steamscuttle", "Dewlotl"];
  const fire = ["Furnadon", "Magmalith", "Ouroblaze"];
  const runs = [
    run("1", "2026-10-20T10:00:00Z", 10, water),
    run("2", "2026-10-20T11:00:00Z", 8, water),
    run("3", "2026-10-21T10:00:00Z", 3, fire),
    run("4", "2026-10-21T11:00:00Z", 4, fire),
    run("5", "2026-10-21T12:00:00Z", 0, [], { outcome: "abandoned" }),
  ];
  const stats = computeStats(runs);
  assert.equal(stats.total.runs, 4);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.total.rankNet, 5 + 3 - 2 - 1);
  assert.equal(stats.total.tenRate, 0.25);
  assert.equal(stats.byComp.length, 2);
  assert.equal(stats.worstComps[0].rankNet, -3);
  assert.ok(stats.worstComps[0].label.includes("Furnadon"));
  assert.equal(stats.byTrainer[0].runs, 4);

  const history: History = { playerId: ME, name: "Me <test>", runs: runs.map((r) => ({ ...r, mmrDelta: null })), snapshots: [] };
  const html = renderReport(history, stats, "pt-BR");
  assert.ok(html.includes("Me &lt;test&gt;"), "name escaped");
  assert.ok(html.includes("Suas piores comps") && html.includes("Your worst comps"), "both languages");
  assert.ok(html.includes('<main data-lang="pt-BR" data-title'), "Portuguese shown by default");
  assert.ok(html.includes('<main data-lang="en" data-title="Match history · Me &lt;test&gt;" hidden>'), "English hidden");
  assert.equal((html.match(/data:image\/png;base64/g) ?? []).length, new Set([...water, ...fire, "Gamer"]).size, "each sprite inlined once");
});

test("mapProfile reads ranked runs and never keeps the Steam ID as a name", () => {
  const raw: RawProfile = {
    owner: ME,
    rank_tier: "master",
    ranked_mmr: 3465,
    season_number: 1,
    user_data: {
      display_name: "76561198000000000",
      games_played: 122,
      runs_won: 58,
      match_history: [
        { run_id: "r1", ended_at: 1761500000, outcome: "lost", round: 9, wins: 4, trainer_id: "pyromaniac", team: [{ species_id: "alpinine", level: 2 }] },
        { run_id: "r2", ended_at: 1761500100, is_ranked: false, outcome: "won", round: 12, wins: 10 },
      ],
    },
  };
  const { player, runs } = mapProfile(raw, []);
  assert.equal(player.name, ME);
  assert.equal(player.rank, "Master");
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].trainers, ["Chef"]);
  assert.deepEqual(runs[0].units, [{ name: "Craghorn", level: 2 }]);
  assert.equal(runs[0].losses, 5);
});

test("nameFilter strips characters that could break the filter", () => {
  assert.equal(nameFilter("Bob' || 1=1"), "user_data.display_name~'Bob  11'");
  assert.equal(nameFilter("SUJIRO KIMIMAME", true), "user_data.display_name='SUJIRO KIMIMAME'");
  assert.equal(nameFilter("ab"), null);
});
