import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { ApiError, PLAYER_ID, displayName, fetchProfile, findAccounts, rankTier, type RawProfile } from "./api";
import { renderApp, renderAppContent, type AppView } from "./appPage";
import { LANGS, TEXTS, isLang, systemLang, type Lang } from "./i18n";
import type { MetaStats } from "./meta";
import { loadCachedMeta, refreshMeta } from "./metaClient";
import { createShortcut, openAppWindow } from "./platform";
import { DATA_DIR, loadConfig, loadHistory, saveConfig, type Config, type History } from "./store";
import { syncHistory, writePage } from "./sync";

// The app: a small web server on 127.0.0.1 that only this computer can
// reach, shown in its own window. While the window is open it checks the
// player's profile every few minutes and saves each new run; closing the
// window ends the app, and nothing keeps running.

export const CHECK_EVERY_MS = 2 * 60_000;
const ERROR_RETRY_MS = 5 * 60_000;
const META_EVERY_MS = 30 * 60_000;
/** With no window process to watch, the app ends this long after the page disconnects. */
const NO_PAGE_GRACE_MS = 20_000;
const FIRST_PAGE_GRACE_MS = 2 * 60_000;
/** The window counts as closed when its process ends, unless it ended this fast (handed off to another browser process). */
const WINDOW_HANDOFF_MS = 10_000;

const INSTANCE_FILE = path.join(DATA_DIR, "app.json");
const LOG_FILE = path.join(DATA_DIR, "app.log");

export async function log(message: string): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never stop the app.
  }
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function time(date: Date, lang: Lang): string {
  return date.toLocaleTimeString(TEXTS[lang].locale, { hour: "2-digit", minute: "2-digit" });
}

function accountLabel(p: RawProfile, lang: Lang): string {
  const t = TEXTS[lang];
  const d = p.user_data ?? {};
  return [displayName(d.display_name) ?? t.noName, rankTier(p.rank_tier) ?? "-", `${p.ranked_mmr ?? "-"} MMR`, t.games(d.games_played ?? 0)].join(" · ");
}

export interface AppOptions {
  /** 0 picks a free port. */
  port?: number;
  checkEveryMs?: number;
  /** Called when the window is closed. */
  onExit?: () => void;
  canShortcut?: boolean;
}

export class App {
  readonly token = randomBytes(16).toString("hex");
  private server: Server = createServer((req, res) => {
    this.handle(req, res).catch((err) => {
      void log(`request failed: ${errorText(err)}`);
      if (!res.headersSent) this.json(res, 500, { error: errorText(err) });
    });
  });
  private port = 0;
  private config: Config | null = null;
  private history: History | null = null;
  private meta: MetaStats | null = null;
  private lastCheck: Date | null = null;
  private nextCheck: Date | null = null;
  private checking = false;
  private error: string | null = null;
  private clients = new Set<ServerResponse>();
  private timers: NodeJS.Timeout[] = [];
  private checkTimer: NodeJS.Timeout | null = null;
  private closeTimer: NodeJS.Timeout | null = null;
  private window: ChildProcess | null = null;
  private stopped = false;

  constructor(private options: AppOptions = {}) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}/${this.token}/`;
  }

  get lang(): Lang {
    return this.config?.lang ?? systemLang();
  }

  async start(): Promise<void> {
    this.config = await loadConfig();
    this.history = await loadHistory();
    this.meta = await loadCachedMeta();
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.options.port ?? 0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    this.port = typeof address === "object" && address ? address.port : 0;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(INSTANCE_FILE, JSON.stringify({ url: this.url, pid: process.pid }));

    void this.check();
    void this.updateMeta();
    this.timers.push(setInterval(() => void this.updateMeta(), META_EVERY_MS));
    // Keeps the event streams alive (some HTTP stacks drop idle connections).
    this.timers.push(setInterval(() => this.clients.forEach((c) => c.write(": ping\n\n")), 5_000));
  }

  /** Opens the window and ends the app when it is closed. */
  openWindow(): void {
    const opened = Date.now();
    const child = openAppWindow(this.url);
    if (!child) return;
    this.window = child;
    child.once("exit", () => {
      if (this.window !== child) return;
      this.window = null;
      if (Date.now() - opened > WINDOW_HANDOFF_MS) void this.stop();
      else this.watchPage();
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.timers.forEach(clearInterval);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    for (const c of this.clients) c.end();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    try {
      const saved = JSON.parse(await readFile(INSTANCE_FILE, "utf8")) as { url?: string };
      if (saved.url === this.url) await rm(INSTANCE_FILE, { force: true });
    } catch {
      // Already gone.
    }
    this.options.onExit?.();
  }

  /** Without a window process, the open page is what keeps the app alive. */
  watchPage(graceMs = NO_PAGE_GRACE_MS): void {
    if (this.window || this.clients.size || this.closeTimer || this.stopped) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (!this.window && !this.clients.size) void this.stop();
    }, graceMs);
  }

  private view(): AppView {
    const status = Object.fromEntries(LANGS.map((l) => [l, this.statusText(l)])) as Record<Lang, string>;
    return {
      config: this.config,
      history: this.history,
      meta: this.meta,
      status,
      canShortcut: this.options.canShortcut ?? process.platform === "win32",
    };
  }

  private statusText(lang: Lang): string {
    const t = TEXTS[lang];
    if (!this.config) return t.statusSetup;
    if (this.checking) return t.statusChecking;
    if (this.error) return t.statusError(this.error, this.nextCheck ? time(this.nextCheck, lang) : "-");
    return t.statusWatching(this.lastCheck ? time(this.lastCheck, lang) : "-");
  }

  private send(message: unknown): void {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const c of this.clients) c.write(data);
  }

  private sendStatus(): void {
    this.send({ type: "status", text: Object.fromEntries(LANGS.map((l) => [l, this.statusText(l)])) });
  }

  /** Checks the profile now, saves new runs and schedules the next check. */
  async check(): Promise<void> {
    if (!this.config || this.checking || this.stopped) return;
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checking = true;
    this.sendStatus();
    let delay = this.options.checkEveryMs ?? CHECK_EVERY_MS;
    try {
      const { history, added } = await syncHistory(this.config);
      this.history = history;
      this.error = null;
      for (const run of added.slice(-3)) {
        const trainer = run.trainers.join(", ") || "?";
        const mmr = run.mmrDelta === null ? "" : ` (${run.mmrDelta > 0 ? "+" : ""}${run.mmrDelta} MMR)`;
        const text = Object.fromEntries(
          LANGS.map((l) => [l, run.outcome === "abandoned" ? TEXTS[l].toastAbandoned(trainer) : TEXTS[l].toastRun(trainer, run.wins, mmr)]),
        );
        this.send({ type: "toast", text });
      }
      if (added.length) {
        await log(`saved ${added.length} new run(s)`);
        this.send({ type: "content" });
      }
    } catch (err) {
      this.error = err instanceof ApiError ? err.message : errorText(err);
      delay = Math.max(delay, ERROR_RETRY_MS);
      await log(`check failed: ${this.error}`);
    } finally {
      this.checking = false;
      this.lastCheck = new Date();
      this.nextCheck = new Date(Date.now() + delay);
      if (!this.stopped) this.checkTimer = setTimeout(() => void this.check(), delay);
      this.sendStatus();
    }
  }

  private async updateMeta(): Promise<void> {
    try {
      const meta = await refreshMeta();
      if (meta && meta.generatedAt !== this.meta?.generatedAt) {
        this.meta = meta;
        this.send({ type: "content" });
      }
    } catch (err) {
      await log(`meta download failed: ${errorText(err)}`);
    }
  }

  private json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(value));
  }

  private html(res: ServerResponse, body: string): void {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  }

  private async body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 10_000) throw new Error("Request too large");
    }
    const value: unknown = text ? JSON.parse(text) : {};
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Only the page this app opened: right host (no DNS rebinding) and the
    // random token in the path (no other site can guess the URL).
    const prefix = `/${this.token}/`;
    if (req.headers.host !== `127.0.0.1:${this.port}` || !req.url?.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    const route = `${req.method} ${url.pathname.slice(prefix.length)}`;
    // POSTs must be JSON, which a page on another site cannot send here without asking first.
    if (req.method === "POST" && !req.headers["content-type"]?.startsWith("application/json")) {
      res.writeHead(415).end();
      return;
    }

    switch (route) {
      case "GET ":
        return this.html(res, renderApp(this.view(), this.lang));
      case "GET content":
        return this.html(res, renderAppContent(this.view()));
      case "GET ping":
        return this.json(res, 200, { ok: true });
      case "GET events":
        return this.events(req, res);
      case "POST check":
        void this.check();
        return this.json(res, 200, { ok: true });
      case "POST focus":
        this.openWindow();
        return this.json(res, 200, { ok: true });
      case "GET api/search":
        return this.search(res, url.searchParams.get("q") ?? "");
      case "POST api/account":
        return this.setAccount(res, await this.body(req));
      case "POST api/lang":
        return this.setLang(res, await this.body(req));
      default:
        res.writeHead(404).end();
    }
  }

  private events(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({ type: "status", text: this.view().status })}\n\n`);
    this.clients.add(res);
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    req.on("close", () => {
      this.clients.delete(res);
      this.watchPage();
    });
  }

  private async search(res: ServerResponse, query: string): Promise<void> {
    try {
      const found = await findAccounts(query);
      if (found === null) return this.json(res, 200, { short: true });
      const accounts = found.map((p) => ({ id: p.owner, label: Object.fromEntries(LANGS.map((l) => [l, accountLabel(p, l)])) }));
      return this.json(res, 200, { accounts });
    } catch (err) {
      return this.json(res, 200, { error: errorText(err) });
    }
  }

  private async setAccount(res: ServerResponse, body: Record<string, unknown>): Promise<void> {
    const id = String(body.id ?? "");
    if (!PLAYER_ID.test(id)) return this.json(res, 400, { error: "Invalid player ID" });
    const lang = isLang(body.lang) ? body.lang : this.lang;
    try {
      const profile = await fetchProfile(id);
      if (!profile) return this.json(res, 200, { error: TEXTS[lang].profileGone(id) });
      this.config = { playerId: id, name: displayName(profile.user_data?.display_name) ?? id, lang };
      await saveConfig(this.config);
      this.history = await loadHistory();
      if (body.shortcut === true && process.platform === "win32") {
        try {
          await createShortcut();
        } catch (err) {
          await log(`shortcut failed: ${errorText(err)}`);
        }
      }
      await this.check();
      this.send({ type: "content" });
      return this.json(res, 200, { ok: true });
    } catch (err) {
      return this.json(res, 200, { error: errorText(err) });
    }
  }

  private async setLang(res: ServerResponse, body: Record<string, unknown>): Promise<void> {
    if (!isLang(body.lang)) return this.json(res, 400, { error: "Unknown language" });
    if (this.config && this.config.lang !== body.lang) {
      this.config = { ...this.config, lang: body.lang };
      await saveConfig(this.config);
      if (this.history) await writePage(this.history, this.config.lang);
    }
    return this.json(res, 200, { ok: true });
  }
}

/** The URL of an app that is already open, if any. */
async function runningApp(): Promise<string | null> {
  try {
    const { url } = JSON.parse(await readFile(INSTANCE_FILE, "utf8")) as { url: string };
    const res = await fetch(`${url}ping`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/**
 * Starts the app and resolves when its window is closed. Opening the .exe
 * again while it is open only opens another window of the same app.
 */
export async function runApp(beforeWindow?: () => Promise<void>): Promise<void> {
  const running = await runningApp();
  if (running) {
    await fetch(`${running}focus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    return;
  }
  let done: () => void = () => {};
  const finished = new Promise<void>((resolve) => (done = resolve));
  const app = new App({ onExit: () => done() });
  await app.start();
  await log(`started at ${app.url.replace(app.token, "…")}`);
  await beforeWindow?.();
  app.openWindow();
  // In a normal browser tab, give the page time to load before watching it.
  app.watchPage(FIRST_PAGE_GRACE_MS);
  await finished;
  await log("window closed, stopping");
}
