import { mkdir, readFile, writeFile } from "node:fs/promises";
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
/** ETag of the saved copy, so a check downloads the file only when it changed. */
const ETAG_FILE = path.join(DATA_DIR, "meta.etag");

export async function loadCachedMeta(): Promise<MetaStats | null> {
  try {
    const value: unknown = JSON.parse(await readFile(META_FILE, "utf8"));
    return isMeta(value) ? value : null;
  } catch {
    return null;
  }
}

async function savedEtag(): Promise<string | null> {
  try {
    return (await readFile(ETAG_FILE, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

/**
 * The newest stats. Asks the server whether the file changed since the saved
 * copy (a tiny request when it did not) and downloads it when it did.
 * Throws when the server cannot be reached.
 */
export async function refreshMeta(): Promise<MetaStats | null> {
  const cached = await loadCachedMeta();
  const etag = cached ? await savedEtag() : null;
  const headers: Record<string, string> = { "User-Agent": `batomon-match-history/${pkg.version}` };
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(META_URL, { headers });
  if (res.status === 304) return cached;
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const value: unknown = await res.json();
  if (!isMeta(value)) return cached;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(META_FILE, JSON.stringify(value));
  await writeFile(ETAG_FILE, res.headers.get("etag") ?? "");
  return value;
}
