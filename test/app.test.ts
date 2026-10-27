import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { MetaStats } from "../src/meta";

// Runs the app against a fake game API and a fake meta.json, in a temporary
// data folder.

const ME = "abcdefghij12345";
let matches = [{ run_id: "r1", ended_at: 1761500000, outcome: "lost", round: 9, wins: 4, trainer_id: "gamer", team: [{ species_id: "dracana", level: 2 }] }];
let mmr = 3000;

const meta: MetaStats = {
  version: 1,
  generatedAt: new Date().toISOString(),
  season: 1,
  windowDays: 14,
  players: 2000,
  runs: 12345,
  selections: 0,
  comps: [
    {
      key: "Dracana|Onsetra|Tengusto",
      name: "Dracana + Onsetra",
      core: ["Dracana", "Onsetra", "Tengusto"],
      units: [{ name: "Dracana", level: 3 }],
      trainers: [{ name: "Gamer", share: 0.5 }],
      runs: 80,
      players: 60,
      avgWins: 8.2,
      tenRate: 0.5,
      playRate: 0.01,
      score: 0.6,
      tier: "S",
    },
  ],
  trainers: [{ name: "Gamer", runs: 900, playRate: 0.1, avgWins: 6.1, tenRate: 0.2, upRate: 0.5, offered: 10, picked: 5, pickRate: 0.5 }],
};

const fake: Server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/meta.json") return res.end(JSON.stringify(meta));
  if (url.pathname.endsWith("/seasons/records"))
    return res.end(JSON.stringify({ items: [{ number: 1, starts_at: "2026-09-01 00:00:00", ends_at: "2026-12-01 00:00:00" }] }));
  if (url.pathname.endsWith("/player_profiles/records")) {
    const filter = url.searchParams.get("filter") ?? "";
    const profile = {
      owner: ME,
      rank_tier: "master",
      ranked_mmr: mmr,
      season_number: 1,
      user_data: { display_name: "Tester", games_played: 10, runs_won: 3, match_history: matches },
    };
    const hit = filter.includes(ME) || filter.includes("Tester");
    return res.end(JSON.stringify({ items: hit ? [profile] : [] }));
  }
  res.statusCode = 404;
  res.end("{}");
});

let App: typeof import("../src/app").App;
let app: InstanceType<typeof App>;
let dataDir: string;

before(async () => {
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", () => r()));
  const port = (fake.address() as { port: number }).port;
  dataDir = await mkdtemp(path.join(os.tmpdir(), "bmh-test-"));
  process.env.BMH_DATA_DIR = dataDir;
  process.env.BATOMON_API_URL = `http://127.0.0.1:${port}`;
  process.env.BMH_META_URL = `http://127.0.0.1:${port}/meta.json`;
  ({ App } = await import("../src/app"));
  app = new App({ canShortcut: false });
  await app.start();
});

after(async () => {
  await app.stop();
  fake.close();
});

const get = (p: string, init?: RequestInit) => fetch(app.url + p, init);
const post = (p: string, body: unknown) =>
  get(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("only answers requests with the token", async () => {
  const base = app.url.replace(app.token + "/", "");
  assert.equal((await fetch(base)).status, 404);
  assert.equal((await fetch(base + "nottoken/ping")).status, 404);
  assert.equal((await get("ping")).status, 200);
  const form = await get("api/lang", { method: "POST", body: "lang=en", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415, "POSTs must be JSON");
});

test("first run: setup form, account search and saving the account", async () => {
  const page = await (await get("")).text();
  assert.ok(page.includes("data-setup"), "setup form shown");
  assert.ok(page.includes('id="app"'));

  assert.deepEqual(await (await get("api/search?q=ab")).json(), { short: true });
  const found = (await (await get("api/search?q=Tester")).json()) as { accounts: { id: string; label: Record<string, string> }[] };
  assert.equal(found.accounts[0].id, ME);
  assert.ok(found.accounts[0].label["pt-BR"].includes("partidas"));

  const saved = await (await post("api/account", { id: ME, lang: "pt-BR", shortcut: false })).json();
  assert.deepEqual(saved, { ok: true });
  const config = JSON.parse(await readFile(path.join(dataDir, "config.json"), "utf8"));
  assert.equal(config.name, "Tester");
  const history = JSON.parse(await readFile(path.join(dataDir, "history.json"), "utf8"));
  assert.equal(history.runs.length, 1, "first check saved the run");
});

test("shows the meta stats and the history once set up", async () => {
  // The first download runs in the background at start.
  for (let i = 0; i < 50 && !(await (await get("content")).text()).includes("Dracana + Onsetra"); i++) await new Promise((r) => setTimeout(r, 20));
  const content = await (await get("content")).text();
  assert.ok(content.includes("Dracana + Onsetra"), "comp from meta.json");
  assert.ok(content.includes('class="tier tS"'));
  assert.ok(content.includes("Melhores comps agora") && content.includes("Best comps right now"));
  assert.ok(content.includes("Tester"), "history tab");
  assert.ok(!content.includes("data-setup"));
});

test("a new run is saved by the next check and announced to the page", async () => {
  const res = await get("events");
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const until = async (text: string) => {
    while (!received.includes(text)) received += decoder.decode((await reader.read()).value);
  };
  await until('"type":"status"');

  matches = [{ ...matches[0], run_id: "r2", ended_at: 1761600000, wins: 7, outcome: "lost" }, ...matches];
  mmr = 3021;
  assert.deepEqual(await (await post("check", {})).json(), { ok: true });
  await until('"type":"content"');
  assert.ok(received.includes("Run salva: Gamer, 7 insígnias (+21 MMR)"));
  await reader.cancel();

  const history = JSON.parse(await readFile(path.join(dataDir, "history.json"), "utf8"));
  assert.equal(history.runs.length, 2);
  assert.ok((await readFile(path.join(dataDir, "index.html"), "utf8")).includes("Tester"), "static page kept up to date");
});
