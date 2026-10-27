import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import pkg from "../package.json";
import { isMeta, type MetaStats } from "./meta";
import { DATA_DIR } from "./store";

// Downloads meta.json, which .github/workflows/meta.yml publishes on the
// meta-data branch every 6 hours, and keeps a copy in the data folder so the
// last stats still show without internet.

export const META_URL =
  process.env.BMH_META_URL ?? "https://raw.githubusercontent.com/PedroBrock/batomon-match-history/meta-data/meta.json";
const META_FILE = path.join(DATA_DIR, "meta.json");
/** Do not download again before this (the file changes every 6 hours). */
const MAX_AGE_MS = 60 * 60_000;

export async function loadCachedMeta(): Promise<MetaStats | null> {
  try {
    const value: unknown = JSON.parse(await readFile(META_FILE, "utf8"));
    return isMeta(value) ? value : null;
  } catch {
    return null;
  }
}

async function cacheAge(): Promise<number> {
  try {
    return Date.now() - (await stat(META_FILE)).mtimeMs;
  } catch {
    return Infinity;
  }
}

/** The newest stats: downloads them when the copy is old. Throws when the download fails. */
export async function refreshMeta(force = false): Promise<MetaStats | null> {
  if (!force && (await cacheAge()) < MAX_AGE_MS) return loadCachedMeta();
  const res = await fetch(META_URL, { headers: { "User-Agent": `batomon-match-history/${pkg.version}` } });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const value: unknown = await res.json();
  if (!isMeta(value)) return loadCachedMeta();
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(META_FILE, JSON.stringify(value));
  return value;
}
