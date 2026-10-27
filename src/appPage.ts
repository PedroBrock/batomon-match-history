import sprites from "./generated/sprites.json";
import { LANGS, LANG_NAMES, TEXTS, type Lang } from "./i18n";
import type { MetaComp, MetaStats, MetaTrainer, TierLetter } from "./meta";
import { Page, SpriteSheet, STYLE, esc, pct } from "./report";
import { computeStats, type Line } from "./stats";
import type { Config, History } from "./store";

// The app window: tabs with the best comps, the trainers and the player's own
// history, plus the first-time setup. The server (app.ts) sends the whole
// page once and then only the content inside #app when something changes;
// the status line comes through server-sent events.

type T = (typeof TEXTS)[Lang];

export interface AppView {
  config: Config | null;
  history: History | null;
  meta: MetaStats | null;
  /** Status line text in each language. */
  status: Record<Lang, string>;
  canShortcut: boolean;
  now?: Date;
}

const TIERS: (TierLetter | null)[] = ["S", "A", "B", "C", null];

function ago(iso: string, t: T, now: Date): string {
  const minutes = Math.round((Date.parse(iso) - now.getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(t.locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(minutes) < 48 * 60) return rtf.format(Math.round(minutes / 60), "hour");
  return rtf.format(Math.round(minutes / 1440), "day");
}

class AppPage extends Page {
  /** Percentage with a decimal below 10%, where whole numbers would all round to 0 or 1. */
  share(x: number): string {
    return x < 0.1 ? `${this.num(x * 100)}%` : pct(x);
  }

  trainerName(name: string): string {
    return `<span class="tr">${this.trainer(name)}${esc(name)}</span>`;
  }

  compRow(c: MetaComp): string {
    const search = [...c.units.map((u) => u.name), ...c.core, ...c.trainers.map((x) => x.name)].join(" ").toLowerCase();
    const trainers = c.trainers
      .map((x) => `<span class="tr" title="${esc(x.name)}">${this.trainer(x.name)}<small>${pct(x.share)}</small></span>`)
      .join("");
    return `<tr data-search="${esc(search)}"><td><div class="comp"><strong>${esc(c.name)}</strong>${this.team(c.units)}</div></td>
<td><div class="trainers">${trainers}</div></td><td>${this.num(c.avgWins)}</td><td>${pct(c.tenRate)}</td><td>${c.runs}</td><td>${c.players}</td><td>${this.share(c.playRate)}</td></tr>`;
  }

  comps(meta: MetaStats | null, now: Date): string {
    const t = this.t;
    if (!meta) return `<h1>${t.metaTitle}</h1><p class="empty">${t.metaMissing}</p>`;
    const head = `<thead><tr><th>${t.thComp}</th><th>${t.thTopTrainers}</th><th>${t.thAvgBadges}</th><th>${t.thTen}</th><th>${t.thRuns}</th><th>${t.thPlayers}</th><th>${t.thPlayRate}</th></tr></thead>`;
    const groups = TIERS.map((tier) => {
      const comps = meta.comps.filter((c) => c.tier === tier);
      if (!comps.length) return "";
      const title = tier ? `<span class="tier t${tier}">${tier}</span>` : esc(t.noTier);
      return `<div class="tier-group" data-group><h2>${title}</h2>
<div class="scroll"><table>${head}<tbody>${comps.map((c) => this.compRow(c)).join("\n")}</tbody></table></div></div>`;
    }).join("\n");
    return `<h1>${t.metaTitle}</h1>
<p class="lead">${esc(t.metaLead(meta.runs, meta.players, meta.season, meta.windowDays, ago(meta.generatedAt, t, now)))}</p>
<label class="filter"><span>${t.filterLabel}</span><input type="search" data-filter placeholder="${esc(t.filterPlaceholder)}" autocomplete="off"></label>
${groups || `<p class="empty">${t.notEnough}</p>`}
<p class="empty" data-no-match hidden>${t.noMatch}</p>
<p class="lead footer">${t.metaHow}</p>`;
  }

  trainers(meta: MetaStats | null, mine: Line[], now: Date): string {
    const t = this.t;
    if (!meta) return `<h1>${t.trainersTitle}</h1><p class="empty">${t.metaMissing}</p>`;
    const myLine = new Map(mine.map((l) => [l.label, l]));
    const rows = meta.trainers
      .filter((x) => x.runs > 0)
      .map((x: MetaTrainer) => {
        const me = myLine.get(x.name);
        return `<tr><td>${this.trainerName(x.name)}</td><td>${this.num(x.avgWins)}</td><td>${pct(x.tenRate)}</td><td>${pct(x.upRate)}</td>
<td>${x.runs} <small>(${this.share(x.playRate)})</small></td><td>${x.pickRate === null ? "-" : pct(x.pickRate)}</td><td>${me ? esc(t.youCell(this.num(me.avgWins), me.runs)) : "-"}</td></tr>`;
      })
      .join("\n");
    return `<h1>${t.trainersTitle}</h1>
<p class="lead">${esc(t.metaLead(meta.runs, meta.players, meta.season, meta.windowDays, ago(meta.generatedAt, t, now)))}</p>
<p class="lead">${esc(t.trainersLead)}</p>
<div class="scroll"><table><thead><tr><th>${t.thTrainer}</th><th>${t.thAvgBadges}</th><th>${t.thTen}</th><th>${t.thUp}</th><th>${t.thRuns}</th><th>${t.thPickRate}</th><th>${t.thYou}</th></tr></thead>
<tbody>${rows}</tbody></table></div>`;
  }

  setup(canShortcut: boolean): string {
    const t = this.t;
    const messages = {
      "data-msg-searching": t.searching,
      "data-msg-short": t.tooShort,
      "data-msg-none": t.noneFound,
      "data-msg-pick": t.setupPick,
      "data-msg-saving": t.setupSaving,
      "data-msg-failed": t.setupFailed,
    };
    const attrs = Object.entries(messages)
      .map(([k, v]) => `${k}="${esc(v)}"`)
      .join(" ");
    return `<div class="setup" data-setup>
<h1>${t.setupTitle}</h1>
<p class="lead">${t.setupLead}</p>
<form data-setup-search ${attrs}>
<input name="q" required minlength="3" maxlength="32" autocomplete="off" aria-label="${esc(t.askName.replace(/[:\s]+$/, ""))}">
<button type="submit">${t.setupSearch}</button>
</form>
${canShortcut ? `<label class="check"><input type="checkbox" data-setup-shortcut checked> ${t.setupShortcut}</label>` : ""}
<div data-setup-results aria-live="polite"></div>
</div>`;
  }

  main(view: AppView, now: Date): string {
    const t = this.t;
    const { config, history, meta } = view;
    const stats = history ? computeStats(history.runs) : null;
    const historyPanel = !config ? this.setup(view.canShortcut) : history && stats ? this.body(history, stats, now) : `<p class="empty">${t.notEnough}</p>`;
    const tab = (id: string, label: string) => `<button type="button" role="tab" data-tab="${id}">${label}</button>`;
    return `<header class="bar">
<p class="status"><span class="dot"></span><span data-status>${esc(view.status[this.lang])}</span></p>
<div class="actions">${config ? `<button type="button" data-check-now>${t.checkNow}</button>` : ""}
<nav aria-label="Language">${LANGS.map((l) => `<button type="button" data-set-lang="${l}" lang="${l}">${LANG_NAMES[l]}</button>`).join("")}</nav></div>
</header>
<div class="tabs" role="tablist">${tab("comps", t.tabComps)}${tab("trainers", t.tabTrainers)}${tab("history", t.tabHistory)}</div>
<section data-panel="comps">${this.comps(meta, now)}</section>
<section data-panel="trainers">${this.trainers(meta, stats?.byTrainer ?? [], now)}</section>
<section data-panel="history">${historyPanel}</section>`;
  }

  constructor(
    t: T,
    sheet: SpriteSheet,
    readonly lang: Lang,
  ) {
    super(t, sheet);
  }
}

/** Everything inside #app: one <main> per language and the sprites they use. */
export function renderAppContent(view: AppView): string {
  const now = view.now ?? new Date();
  const sheet = new SpriteSheet();
  const title = (l: Lang) => (view.config ? `${TEXTS[l].appTitle} · ${view.config.name}` : TEXTS[l].appTitle);
  const mains = LANGS.map(
    (l) => `<main data-lang="${l}" data-title="${esc(title(l))}" hidden>
${new AppPage(TEXTS[l], sheet, l).main(view, now)}
</main>`,
  ).join("\n");
  return `<style>${sheet.css()}</style>\n${mains}`;
}

const APP_STYLE = `
main { padding-top:14px; }
.actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.bar nav { margin:0; padding:0; }
.bar { max-width:1100px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.status { margin:0; color:var(--muted); font-size:13px; display:flex; align-items:center; gap:8px; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--up); box-shadow:0 0 8px var(--up); flex:none; }
button { background:var(--panel); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:6px 12px; font:inherit; font-size:14px; cursor:pointer; }
button:hover { border-color:var(--accent); }
.tabs { display:flex; gap:4px; margin:14px 0 18px; border-bottom:1px solid var(--line); }
.tabs button { border:0; border-bottom:2px solid transparent; border-radius:0; background:none; color:var(--muted); padding:8px 14px; font-size:15px; }
.tabs button[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--accent); }
section[hidden] { display:none; }
.filter { display:flex; flex-direction:column; gap:4px; margin:14px 0 4px; max-width:360px; color:var(--muted); font-size:13px; }
input[type=search], .setup input[name=q] { background:var(--panel); color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:8px 10px; font:inherit; }
input:focus { outline:2px solid var(--accent); outline-offset:1px; }
.tier-group h2 { margin-top:24px; }
.tier { display:inline-grid; place-items:center; width:36px; height:36px; border-radius:8px; color:#0b1020; font-weight:800; }
.tS { background:#ff7a7a; } .tA { background:#ffb86b; } .tB { background:#ffe27a; } .tC { background:#8fd18b; }
.trainers { display:flex; gap:8px; flex-wrap:wrap; }
.setup form { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0 10px; }
.setup input[name=q] { min-width:260px; flex:1; max-width:420px; }
.setup .check { display:flex; gap:8px; align-items:center; color:var(--muted); }
[data-setup-results] { margin-top:14px; display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.toasts { position:fixed; right:16px; bottom:16px; display:flex; flex-direction:column; gap:8px; z-index:10; }
.toast { background:var(--panel); border:1px solid var(--accent); border-radius:10px; padding:10px 14px; box-shadow:0 6px 24px #0008; }
`;

/** Tabs, language, filter, setup and live updates. */
function appScript(lang: Lang): string {
  return `(function () {
  var LANG_KEY = "bmh-lang", TAB_KEY = "bmh-tab";
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  var lang = load(LANG_KEY) || ${JSON.stringify(lang)};
  var tab = load(TAB_KEY);
  var app = document.getElementById("app");

  function apply() {
    var mains = app.querySelectorAll("main[data-lang]");
    if (!app.querySelector('main[data-lang="' + lang + '"]') && mains[0]) lang = mains[0].dataset.lang;
    var setup = app.querySelector("[data-setup]");
    var shown = setup ? "history" : (tab || "comps");
    mains.forEach(function (m) {
      m.hidden = m.dataset.lang !== lang;
      if (!m.hidden) document.title = m.dataset.title;
      m.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === shown)); });
      m.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== shown; });
    });
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-set-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.setLang === lang)); });
  }

  function filter(input) {
    var q = input.value.trim().toLowerCase();
    var panel = input.closest("section");
    var any = false;
    panel.querySelectorAll("[data-group]").forEach(function (g) {
      var visible = 0;
      g.querySelectorAll("tr[data-search]").forEach(function (row) {
        var ok = !q || q.split(/[\\s,]+/).every(function (w) { return row.dataset.search.indexOf(w) !== -1; });
        row.hidden = !ok;
        if (ok) visible++;
      });
      g.hidden = visible === 0;
      if (visible) any = true;
    });
    var none = panel.querySelector("[data-no-match]");
    if (none) none.hidden = any;
  }

  function post(path, body) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json(); });
  }

  function reload() {
    var filters = {};
    app.querySelectorAll("main[data-lang]").forEach(function (m) {
      var f = m.querySelector("[data-filter]");
      if (f) filters[m.dataset.lang] = f.value;
    });
    fetch("content").then(function (r) { return r.text(); }).then(function (html) {
      var y = window.scrollY;
      app.innerHTML = html;
      app.querySelectorAll("main[data-lang]").forEach(function (m) {
        var f = m.querySelector("[data-filter]");
        if (f && filters[m.dataset.lang]) { f.value = filters[m.dataset.lang]; filter(f); }
      });
      apply();
      window.scrollTo(0, y);
    });
  }

  function toast(text) {
    var box = document.querySelector(".toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 12000);
  }

  function searchAccounts(form) {
    var out = form.parentNode.querySelector("[data-setup-results]");
    out.textContent = form.dataset.msgSearching;
    fetch("api/search?q=" + encodeURIComponent(form.q.value)).then(function (r) { return r.json(); }).then(function (res) {
      out.textContent = "";
      if (res.error) { out.textContent = form.dataset.msgFailed + " " + res.error; return; }
      if (res.short) { out.textContent = form.dataset.msgShort; return; }
      if (!res.accounts.length) { out.textContent = form.dataset.msgNone; return; }
      var p = document.createElement("p");
      p.textContent = form.dataset.msgPick;
      out.appendChild(p);
      res.accounts.forEach(function (a) {
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.account = a.id;
        b.textContent = a.label[lang] || a.label.en;
        out.appendChild(b);
      });
    }).catch(function (e) { out.textContent = form.dataset.msgFailed + " " + e.message; });
  }

  function pickAccount(button) {
    var setup = button.closest("[data-setup]");
    var form = setup.querySelector("[data-setup-search]");
    var out = setup.querySelector("[data-setup-results]");
    var shortcut = setup.querySelector("[data-setup-shortcut]");
    out.textContent = form.dataset.msgSaving;
    post("api/account", { id: button.dataset.account, lang: lang, shortcut: Boolean(shortcut && shortcut.checked) }).then(function (res) {
      if (res.error) out.textContent = form.dataset.msgFailed + " " + res.error;
      else reload();
    });
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-set-lang],[data-tab],[data-check-now],[data-account]");
    if (!el) return;
    if (el.dataset.setLang) {
      lang = el.dataset.setLang;
      store(LANG_KEY, lang);
      post("api/lang", { lang: lang });
    } else if (el.dataset.tab) {
      tab = el.dataset.tab;
      store(TAB_KEY, tab);
    } else if (el.hasAttribute("data-check-now")) {
      post("check");
    } else if (el.dataset.account) {
      pickAccount(el);
      return;
    }
    apply();
  });
  document.addEventListener("input", function (e) { if (e.target.matches("[data-filter]")) filter(e.target); });
  document.addEventListener("submit", function (e) {
    if (!e.target.matches("[data-setup-search]")) return;
    e.preventDefault();
    searchAccounts(e.target);
  });

  var events = new EventSource("events");
  events.onmessage = function (e) {
    var msg = JSON.parse(e.data);
    if (msg.type === "status") app.querySelectorAll("main[data-lang]").forEach(function (m) {
      var s = m.querySelector("[data-status]");
      if (s) s.textContent = msg.text[m.dataset.lang];
    });
    else if (msg.type === "toast") toast(msg.text[lang] || msg.text.en);
    else if (msg.type === "content") reload();
  };
  apply();
})();
`;
}

const ICON = (sprites as Record<string, string>)["monster/ignit.png"];

export function renderApp(view: AppView, lang: Lang): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TEXTS[lang].appTitle)}</title>
${ICON ? `<link rel="icon" href="data:image/png;base64,${ICON}">` : ""}
<style>
${STYLE}
${APP_STYLE}
</style>
</head>
<body>
<div id="app">
${renderAppContent(view)}
</div>
<div class="toasts" aria-live="polite"></div>
<script>
${appScript(lang)}</script>
</body>
</html>
`;
}
