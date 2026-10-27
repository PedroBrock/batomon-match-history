import assert from "node:assert/strict";
import { test } from "node:test";
import { mapSelection } from "../src/api";
import { buildMeta, buildTrainers, isMeta } from "../src/meta";
import type { Run } from "../src/types";

function run(i: number, player: string, units: string[], wins: number, trainer = "Gamer", endedAt = "2026-10-26T10:00:00Z"): Run {
  return {
    id: `r${i}`,
    playerId: player,
    season: 1,
    trainers: [trainer],
    units: units.map((name) => ({ name, level: 2 })),
    wins,
    losses: 3,
    outcome: wins >= 10 ? "won" : "lost",
    mmr: null,
    rank: "Master",
    round: wins + 3,
    endedAt,
  };
}

/** n runs of a comp, each by a different player. */
function comp(start: number, n: number, units: string[], wins: (i: number) => number, trainer = "Gamer"): Run[] {
  return Array.from({ length: n }, (_, i) => run(start + i, `p${start + i}`, units, wins(i), trainer));
}

test("buildMeta gives tiers to comps with enough runs and players", () => {
  const names = ["Dracana", "Opalion", "Boomagon", "Lumijel", "Swoonet", "Dewlotl", "Furnadon", "Magmalith", "Ouroblaze"];
  const runs: Run[] = [];
  // 9 comps, each with its own 3-Batomon core; the first one is the best.
  for (let c = 0; c < 9; c++) {
    const core = [names[c], `${names[c]}2`, `${names[c]}3`];
    runs.push(...comp(c * 100, 50, core, (i) => (i < 40 - c * 4 ? 10 : 4), c === 0 ? "Chef" : "Gamer"));
  }
  // Too few runs to count, and runs out of the window or season.
  runs.push(...comp(2000, 10, ["A", "B", "C"], () => 10));
  runs.push(run(3000, "old", ["Dracana", "Dracana2", "Dracana3"], 10, "Gamer", "2026-09-01T10:00:00Z"));
  runs.push({ ...run(3001, "s0", ["Dracana", "Dracana2", "Dracana3"], 10), season: 0 });

  const meta = buildMeta(runs, [], 1, 14, new Date("2026-10-27T00:00:00Z"));
  assert.ok(isMeta(meta));
  assert.equal(meta.runs, 9 * 50 + 10);
  assert.equal(meta.comps.length, 9);
  assert.equal(meta.comps[0].tier, "S");
  assert.ok(meta.comps[0].core.includes("Dracana"));
  assert.equal(meta.comps[0].trainers[0].name, "Chef");
  assert.equal(meta.comps[0].units.length, 3);
  assert.deepEqual(
    meta.comps.map((c) => c.tier),
    ["S", "A", "A", "B", "B", "B", "C", "C", "C"],
  );
});

test("buildMeta gives no letters when few comps qualify", () => {
  const runs = comp(0, 50, ["A", "B", "C"], () => 10);
  const meta = buildMeta(runs, [], 1, 14, new Date("2026-10-27T00:00:00Z"));
  assert.equal(meta.comps.length, 1);
  assert.equal(meta.comps[0].tier, null);
});

test("buildTrainers works out win rates and pick rate when offered", () => {
  const runs = [run(1, "a", [], 10, "Gamer"), run(2, "b", [], 4, "Gamer"), run(3, "c", [], 6, "Chef")];
  const selections = [
    { offered: ["Gamer", "Chef", "Twins"], picked: "Gamer" },
    { offered: ["Gamer", "Twins", "Painter"], picked: "Twins" },
  ];
  const trainers = buildTrainers(runs, selections);
  const gamer = trainers.find((t) => t.name === "Gamer")!;
  assert.equal(gamer.runs, 2);
  assert.equal(gamer.avgWins, 7);
  assert.equal(gamer.tenRate, 0.5);
  assert.equal(gamer.pickRate, 0.5);
  const chef = trainers.find((t) => t.name === "Chef")!;
  assert.equal(chef.upRate, 1);
  assert.equal(chef.pickRate, 0);
  assert.equal(trainers.find((t) => t.name === "Painter")?.runs, 0);
});

test("mapSelection reads the trainer lists in the shapes the API may use", () => {
  assert.deepEqual(mapSelection({ offered_trainers: ["pyromaniac", "youngster_f"], picked_trainer: "lady" }), {
    offered: ["Chef", "Lucky Girl"],
    picked: "Rich Lady",
  });
  assert.deepEqual(mapSelection({ offered_trainers: '[{"id":"gamer"},{"trainer_id":"twins"}]', picked_trainer: { id: "gamer" } }), {
    offered: ["Gamer", "Twins"],
    picked: "Gamer",
  });
  assert.deepEqual(mapSelection({}), { offered: [], picked: null });
});
