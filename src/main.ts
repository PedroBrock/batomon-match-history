import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import pkg from "../package.json";
import { ApiError, rankTier, displayName, findAccounts, type RawProfile } from "./api";
import { log, runApp } from "./app";
import { LANGS, LANG_NAMES, TEXTS, isLang, systemLang, type Lang } from "./i18n";
import { createShortcut, hideOwnConsole, installedExe, isPackaged, openFile } from "./platform";
import {
  DATA_DIR,
  PAGE_FILE,
  isHistory,
  loadConfig,
  loadHistory,
  mergeHistories,
  saveConfig,
  saveHistory,
  type Config,
} from "./store";
import { syncHistory, writePage } from "./sync";

// Entry point. Double-clicking the .exe (or the desktop shortcut) runs it
// with no arguments, which opens the app window (app.ts): first-time setup
// happens there, and while it is open it keeps saving new runs. Commands
// (see TEXTS.usage) are for people who prefer a terminal.

type T = (typeof TEXTS)[Lang];

let t: T = TEXTS[systemLang()];
let rl: Interface | null = null;
/** After the console window is hidden there is nobody to read it or press Enter. */
let consoleHidden = false;

function ask(question: string): Promise<string> {
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question);
}

const isNo = (answer: string) => ["n", "no", "nao", "não"].includes(answer.trim().toLowerCase());

function describe(p: RawProfile): string {
  const d = p.user_data ?? {};
  return `${displayName(d.display_name) ?? t.noName}  ${rankTier(p.rank_tier) ?? "-"} ${p.ranked_mmr ?? "-"} MMR  ${t.games(d.games_played ?? 0)}  (ID ${p.owner})`;
}

async function chooseLang(): Promise<Lang> {
  const fallback = systemLang();
  console.log(TEXTS.en.chooseLang);
  LANGS.forEach((l, i) => console.log(`  ${i + 1}) ${LANG_NAMES[l]}`));
  for (;;) {
    const answer = (await ask(`[${LANGS.indexOf(fallback) + 1}] `)).trim();
    if (!answer) return fallback;
    const lang = LANGS[Number(answer) - 1];
    if (lang) return lang;
  }
}

async function pickAccount(): Promise<RawProfile> {
  for (;;) {
    const query = (await ask(t.askName)).trim();
    console.log(t.searching);
    const found = await findAccounts(query);
    if (found === null) console.log(t.tooShort);
    else if (!found.length) console.log(t.noneFound);
    else if (found.length === 1) {
      if (!isNo(await ask(t.confirmAccount(describe(found[0]))))) return found[0];
    } else {
      console.log(t.foundMany);
      found.forEach((p, i) => console.log(`  ${i + 1}) ${describe(p)}`));
      const chosen = found[Number((await ask(t.pickAccount)).trim()) - 1];
      if (chosen) return chosen;
    }
  }
}

async function saveAccount(profile: RawProfile, lang: Lang): Promise<Config> {
  const config: Config = { playerId: profile.owner, name: displayName(profile.user_data?.display_name) ?? profile.owner, lang };
  await saveConfig(config);
  console.log(t.saved(describe(profile)));
  return config;
}

async function offerShortcut(): Promise<void> {
  if (process.platform !== "win32") return;
  if (isNo(await ask(t.askShortcut))) return;
  console.log(t.shortcutCreated(await createShortcut()));
}

async function firstRun(): Promise<Config> {
  console.log(`Batomon Match History ${pkg.version}\n`);
  const lang = await chooseLang();
  t = TEXTS[lang];
  const config = await saveAccount(await pickAccount(), lang);
  await offerShortcut();
  console.log(t.dataAt(DATA_DIR) + "\n");
  return config;
}

/** setup "Name" | ID, without questions: saves the account only when the match is unambiguous. */
async function setup(query: string, lang: Lang): Promise<void> {
  const found = await findAccounts(query);
  if (found === null) throw new Error(t.tooShort);
  if (found.length === 1) {
    await saveAccount(found[0], lang);
    return;
  }
  console.log(found.length ? t.foundMany : t.noneFound);
  for (const p of found) console.log(`  ${describe(p)}`);
}

async function report(config: Config): Promise<void> {
  const history = await loadHistory();
  if (!history) throw new Error(t.noHistory);
  await writePage(history, config.lang);
  console.log(t.pageAt(PAGE_FILE));
}

async function sync(config: Config): Promise<void> {
  const { history, added } = await syncHistory(config);
  const snap = history.snapshots.at(-1);
  console.log(`${t.syncResult(added.length, history.runs.length)} ${snap?.rank ?? ""} ${snap?.mmr ?? ""} MMR`);
  for (const r of added.slice(-10)) {
    const trainer = r.trainers.join(", ") || "?";
    const mmr = r.mmrDelta === null ? "" : ` (${r.mmrDelta > 0 ? "+" : ""}${r.mmrDelta} MMR)`;
    console.log(`   ${r.outcome === "abandoned" ? t.runAbandoned(trainer) : t.runLine(trainer, r.wins)}${mmr}`);
  }
  console.log(t.pageAt(PAGE_FILE));
}

/** The app window. Started by double-click, the console window is hidden and messages go to app.log. */
async function app(): Promise<void> {
  await runApp(async () => {
    if (!isPackaged() || !(await hideOwnConsole())) return;
    consoleHidden = true;
    console.log = (...args: unknown[]) => void log(args.join(" "));
    console.error = console.log;
  });
}

async function importFile(file: string, config: Config | null): Promise<Config> {
  let other: unknown;
  try {
    other = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error(t.badFile(file));
  }
  if (!isHistory(other)) throw new Error(t.badFile(file));
  const { history, added } = mergeHistories(await loadHistory(), other);
  await saveHistory(history);
  console.log(t.imported(added, file));
  const result = config ?? { playerId: history.playerId, name: history.name, lang: systemLang() };
  if (!config) await saveConfig(result);
  await report(result);
  return result;
}

function requireConfig(config: Config | null): Config {
  if (!config) throw new Error(t.noConfig);
  return config;
}

/** Keeps the console window open long enough to read it. */
async function pause(ms?: number): Promise<void> {
  if (!process.stdin.isTTY || consoleHidden) return;
  const enter = ask(`\n${ms ? t.closing : t.pressEnter}`);
  await (ms ? Promise.race([enter, new Promise((r) => setTimeout(r, ms))]) : enter);
}

async function main(): Promise<boolean> {
  const [command, arg] = process.argv.slice(2);
  let config = await loadConfig();
  if (config) t = TEXTS[config.lang] ?? t;
  // Dropping a history.json on the .exe passes its path as the only argument.
  const dropped = command && command.toLowerCase().endsWith(".json") && existsSync(command) ? command : null;
  // Started by double-click: keep the console open long enough to read it.
  const windowed = Boolean(dropped);

  try {
    if (isPackaged() && process.platform === "win32") await installedExe();
    switch (dropped ? "import" : command) {
      case undefined:
      case "app":
        await app();
        break;
      case "import":
        if (!(dropped ?? arg)) throw new Error(t.usage);
        await importFile(path.resolve(dropped ?? arg), config);
        if (dropped) openFile(PAGE_FILE);
        break;
      case "setup":
        if (arg) await setup(arg, config?.lang ?? systemLang());
        else if (process.stdin.isTTY) await firstRun();
        else throw new Error(t.usage);
        break;
      case "sync":
        await sync(requireConfig(config));
        break;
      case "report":
        await report(requireConfig(config));
        break;
      case "open":
        openFile(PAGE_FILE);
        break;
      case "shortcut":
        if (process.platform !== "win32") throw new Error(t.shortcutOnlyWindows);
        console.log(t.shortcutCreated(await createShortcut()));
        break;
      case "lang": {
        if (!isLang(arg)) throw new Error(t.usage);
        config = { ...requireConfig(config), lang: arg };
        t = TEXTS[arg];
        await saveConfig(config);
        if (await loadHistory()) await report(config);
        break;
      }
      case "help":
      case "--help":
      case "-h":
      case "--version":
        console.log(`Batomon Match History ${pkg.version}\n\n${t.usage}`);
        break;
      default:
        throw new Error(t.usage);
    }
    if (windowed) await pause(15_000);
    return true;
  } catch (err) {
    console.error(err instanceof ApiError ? t.apiDown(err.message) : (err as Error).message);
    if (windowed || !command) await pause();
    return false;
  }
}

main().then((ok) => {
  rl?.close();
  process.exit(ok ? 0 : 1);
});
