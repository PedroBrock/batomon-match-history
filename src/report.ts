import catalog from "../assets/catalog.json";
import sprites from "./generated/sprites.json";
import { LANGS, LANG_NAMES, TEXTS, type Lang } from "./i18n";
import { MIN_GROUP_RUNS, OTHER_COMPS, type DayLine, type Line, type PersonalStats } from "./stats";
import type { History, MyRun, Snapshot } from "./store";
import { MAX_WINS, type Unit } from "./types";

// The history page: a single HTML file with no server and no external files.
// It holds one copy of the content per language and a switch between them;
// the sprites it uses are inlined once, as CSS classes.

const monsters: Record<string, string> = catalog.monsters;
const trainers: Record<string, string> = catalog.trainers;
const spriteData: Record<string, string> = sprites;

type T = (typeof TEXTS)[Lang];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => (x > 0 ? `+${x}` : String(x));
const tone = (x: number) => (x > 0 ? "up" : x < 0 ? "down" : "");

/** Sprites used by the page, each given a short CSS class. */
class SpriteSheet {
  private classes = new Map<string, string>();

  icon(key: string | undefined, name: string, kind: "unit" | "trainer"): string {
    if (!key || !spriteData[key]) return kind === "unit" ? `<span class="noimg" title="${esc(name)}">${esc(name.slice(0, 3))}</span>` : "";
    let cls = this.classes.get(key);
    if (!cls) this.classes.set(key, (cls = `s${this.classes.size}`));
    return `<i class="sp ${kind === "trainer" ? "trainer " : ""}${cls}" role="img" aria-label="${esc(name)}" title="${esc(name)}"></i>`;
  }

  css(): string {
    return [...this.classes]
      .map(([key, cls]) => `.${cls}{background-image:url(data:image/png;base64,${spriteData[key]})}`)
      .join("\n");
  }
}

class Page {
  constructor(
    private t: T,
    private sheet: SpriteSheet,
  ) {}

  num(x: number, digits = 1): string {
    return x.toFixed(digits).replace(".", this.t.decimal);
  }

  date(iso: string, time = true): string {
    return new Date(iso).toLocaleString(this.t.locale, time ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" });
  }

  unit(u: Unit, showLevel = true): string {
    const file = monsters[u.name];
    return `<span class="unit">${this.sheet.icon(file && `monster/${file}`, u.name, "unit")}${showLevel ? `<b>${u.level}</b>` : ""}</span>`;
  }

  trainer(name: string): string {
    const file = trainers[name];
    return this.sheet.icon(file && `trainer/${file}`, name, "trainer");
  }

  team(units: Unit[], showLevel = true): string {
    return `<span class="team">${units.map((u) => this.unit(u, showLevel)).join("")}</span>`;
  }

  card(label: string, value: string, hint = ""): string {
    return `<div class="card"><span>${label}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ""}</div>`;
  }

  lineTable(lines: Line[], first: string, cell: (l: Line) => string): string {
    const t = this.t;
    if (!lines.length) return `<p class="empty">${t.notEnough}</p>`;
    const rows = lines
      .map(
        (l) => `<tr><td>${cell(l)}</td><td>${l.runs}</td><td>${this.num(l.avgWins)}</td><td>${pct(l.tenRate)}</td><td>${pct(l.upRate)}</td>
<td class="${tone(l.rankNet)}">${signed(l.rankNet)}</td></tr>`,
      )
      .join("\n");
    return `<table><thead><tr><th>${first}</th><th>${t.thRuns}</th><th>${t.thAvgBadges}</th><th>${t.thTen}</th><th>${t.thUp}</th><th>${t.thNet}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  }

  compCell = (l: Line): string => {
    const label = l.key === OTHER_COMPS ? this.t.others : l.label;
    return `<div class="comp"><strong>${esc(label)}</strong>${l.units.length ? this.team(l.units) : ""}</div>`;
  };

  runsTable(runs: MyRun[]): string {
    const t = this.t;
    const rows = runs
      .map((r) => {
        const result = r.outcome === "abandoned" ? t.abandoned : `${r.wins} / ${MAX_WINS}`;
        const delta = r.outcome === "abandoned" ? "" : signed(r.wins - 5);
        const mmr = r.mmrDelta === null ? "" : `<small class="${tone(r.mmrDelta)}">${signed(r.mmrDelta)} MMR</small>`;
        return `<tr><td>${this.date(r.endedAt)}</td><td><span class="tr">${r.trainers.map((n) => this.trainer(n)).join("")}${esc(r.trainers.join(", ") || "?")}</span></td>
<td>${this.team(r.units)}</td><td>${result}</td><td class="${tone(r.wins - 5)}">${delta} ${mmr}</td><td>${r.losses ?? "?"}</td><td>${r.round}</td></tr>`;
      })
      .join("\n");
    return `<table><thead><tr><th>${t.thWhen}</th><th>${t.thTrainer}</th><th>${t.thTeam}</th><th>${t.thBadges}</th><th>${t.thRank}</th><th>${t.thLosses}</th><th>${t.thRounds}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
  }

  daysTable(days: DayLine[]): string {
    const t = this.t;
    if (!days.length) return `<p class="empty">${t.notEnough}</p>`;
    const rows = days
      .map((d) => {
        const [y, m, day] = d.day.split("-").map(Number);
        const label = new Date(y, m - 1, day).toLocaleDateString(t.locale, { dateStyle: "short" });
        return `<tr><td>${label}</td><td>${d.runs}</td><td>${this.num(d.avgWins)}</td><td class="${tone(d.rankNet)}">${signed(d.rankNet)}</td></tr>`;
      })
      .join("\n");
    return `<table><thead><tr><th>${t.thDay}</th><th>${t.thRuns}</th><th>${t.thAvgBadges}</th><th>${t.thNet}</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  /** MMR over time, from the saved checks. */
  mmrChart(snapshots: Snapshot[]): string {
    const points = snapshots.filter((s) => s.mmr !== null) as (Snapshot & { mmr: number })[];
    if (points.length < 2) return `<p class="empty">${this.t.chartEmpty}</p>`;
    const W = 800;
    const H = 180;
    const pad = 8;
    const t0 = Date.parse(points[0].at);
    const t1 = Date.parse(points.at(-1)!.at);
    const lo = Math.min(...points.map((p) => p.mmr));
    const hi = Math.max(...points.map((p) => p.mmr));
    const x = (s: Snapshot) => pad + ((Date.parse(s.at) - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad);
    const y = (m: number) => H - pad - ((m - lo) / Math.max(1, hi - lo)) * (H - 2 * pad);
    const path = points.map((p) => `${x(p).toFixed(1)},${y(p.mmr).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${this.t.chartLabel(lo, hi)}">
<polyline points="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
<text x="${W - pad}" y="16" text-anchor="end">${hi}</text><text x="${W - pad}" y="${H - 12}" text-anchor="end">${lo}</text></svg>`;
  }

  body(history: History, stats: PersonalStats, now: Date): string {
    const t = this.t;
    const snap = history.snapshots.at(-1);
    const total = stats.total;
    const last20 = stats.last20;
    const recent = [...history.runs].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
    const since = history.runs[0] ? this.date(history.runs[0].endedAt, false) : "-";
    const updated = snap ? this.date(snap.at) : "-";
    const worst = stats.worstComps.length
      ? this.lineTable(stats.worstComps, t.thComp, this.compCell)
      : `<p class="empty">${t.noWorst(MIN_GROUP_RUNS)}</p>`;

    return `<h1>${esc(history.name)}</h1>
<p class="lead">${snap?.rank ?? t.unranked}${snap?.mmr != null ? ` · ${snap.mmr} MMR` : ""} · ${t.lead(since, updated)}</p>

<div class="cards">
${snap?.games ? this.card(t.accountWinRate, pct(snap.wins / snap.games), t.winsInGames(snap.wins, snap.games)) : ""}
${this.card(t.rankedRuns, String(total.runs), stats.abandoned ? t.plusAbandoned(stats.abandoned) : "")}
${this.card(t.avgBadges, this.num(total.avgWins), last20 ? t.last20(this.num(last20.avgWins)) : "")}
${this.card(t.tenBadges, pct(total.tenRate), last20 ? t.last20(pct(last20.tenRate)) : "")}
${this.card(t.rankedUp, pct(total.upRate), t.rankedUpHint)}
${this.card(t.rankNet, `<span class="${tone(total.rankNet)}">${signed(total.rankNet)}</span>`, t.rankNetHint)}
${this.card(t.roundsWon, total.roundWinRate === null ? "-" : pct(total.roundWinRate), t.roundsWonHint)}
</div>
<p class="tip">${t.tip}</p>

<h2>${t.worstTitle}</h2>
<p class="lead">${t.worstLead(MIN_GROUP_RUNS)}</p>
<div class="scroll">${worst}</div>

<h2>${t.compsTitle}</h2>
<p class="lead">${t.compsLead}</p>
<div class="scroll">${this.lineTable(stats.byComp, t.thComp, this.compCell)}</div>

<h2>${t.trainerTitle}</h2>
<div class="scroll">${this.lineTable(stats.byTrainer, t.thTrainer, (l) => `<span class="tr">${this.trainer(l.label)}${esc(l.label)}</span>`)}</div>

<h2>${t.monsterTitle}</h2>
<p class="lead">${t.monsterLead}</p>
<div class="scroll">${this.lineTable(stats.byMonster, t.thBatomon, (l) => `<span class="tr">${this.team(l.units, false)}${esc(l.label)}</span>`)}</div>

<h2>${t.mmrTitle}</h2>
${this.mmrChart(history.snapshots)}

<h2>${t.dayTitle}</h2>
<div class="scroll">${this.daysTable(stats.byDay)}</div>

<h2>${t.runsTitle}</h2>
<div class="scroll">${this.runsTable(recent)}</div>

<p class="lead footer">${esc(t.footer(now.toLocaleString(t.locale)))}</p>`;
  }
}

export function renderReport(history: History, stats: PersonalStats, lang: Lang, now = new Date()): string {
  const sheet = new SpriteSheet();
  const mains = LANGS.map(
    (l) =>
      `<main data-lang="${l}" data-title="${esc(`${TEXTS[l].title} · ${history.name}`)}"${l === lang ? "" : " hidden"}>
${new Page(TEXTS[l], sheet).body(history, stats, now)}
</main>`,
  ).join("\n");
  const switcher = LANGS.map((l) => `<button type="button" data-set-lang="${l}" lang="${l}">${LANG_NAMES[l]}</button>`).join("");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`${TEXTS[lang].title} · ${history.name}`)}</title>
<style>
:root { --bg:#0b1020; --panel:#121a2e; --line:#24304d; --ink:#e8ecf6; --muted:#94a0bd; --accent:#3ee0c4; --up:#4fd18b; --down:#ff5d73; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 system-ui, "Segoe UI", sans-serif; }
nav { max-width:1100px; margin:0 auto; padding:12px 16px 0; display:flex; justify-content:flex-end; gap:6px; }
nav button { background:var(--panel); color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:4px 12px; font:inherit; font-size:13px; cursor:pointer; }
nav button[aria-pressed="true"] { color:var(--bg); background:var(--accent); border-color:var(--accent); }
main { max-width:1100px; margin:0 auto; padding:12px 16px 64px; }
main[hidden] { display:none; }
h1 { margin:0 0 4px; font-size:28px; } h2 { margin:36px 0 10px; font-size:20px; }
p.lead, .empty, small { color:var(--muted); }
.tip { margin:14px 0 0; padding:10px 14px; border-left:3px solid var(--accent); background:var(--panel); border-radius:6px; color:var(--muted); font-size:14px; }
.footer { margin-top:32px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-top:18px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:2px; }
.card > span { color:var(--muted); font-size:13px; } .card strong { font-size:24px; }
.scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
th, td { padding:8px 10px; text-align:left; border-bottom:1px solid var(--line); vertical-align:middle; white-space:nowrap; }
th { color:var(--muted); font-weight:600; font-size:13px; }
.up { color:var(--up); } .down { color:var(--down); }
.team { display:inline-flex; gap:2px; flex-wrap:wrap; }
.unit { position:relative; display:inline-block; width:36px; height:36px; }
.sp { display:inline-block; width:36px; height:36px; background-size:contain; background-repeat:no-repeat; image-rendering:pixelated; }
.sp.trainer { width:28px; height:28px; }
.noimg { display:inline-grid; place-items:center; width:36px; height:36px; background:var(--line); border-radius:6px; font-size:11px; }
.unit b { position:absolute; right:-2px; bottom:-2px; font-size:10px; background:#000a; border-radius:4px; padding:0 3px; }
.comp { display:flex; flex-direction:column; gap:4px; }
.tr { display:flex; align-items:center; gap:6px; }
.chart { width:100%; height:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; }
.chart text { fill:var(--muted); font-size:12px; }
${sheet.css()}
</style>
</head>
<body>
<nav aria-label="Language">${switcher}</nav>
${mains}
<script>
(function () {
  var KEY = "bmh-lang";
  function pick(lang) {
    var mains = document.querySelectorAll("main[data-lang]");
    var found = false;
    mains.forEach(function (m) { if (m.dataset.lang === lang) found = true; });
    if (!found) return;
    mains.forEach(function (m) {
      m.hidden = m.dataset.lang !== lang;
      if (!m.hidden) document.title = m.dataset.title;
    });
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-set-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.setLang === lang)); });
  }
  document.querySelectorAll("[data-set-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      pick(b.dataset.setLang);
      try { localStorage.setItem(KEY, b.dataset.setLang); } catch (e) {}
    });
  });
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  pick(saved || ${JSON.stringify(lang)});
})();
</script>
</body>
</html>
`;
}
