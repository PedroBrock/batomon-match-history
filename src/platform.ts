import { execFileSync, spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./store";

// Operating system bits: opening the page, the desktop shortcut, and keeping
// a copy of the .exe next to the data so the shortcut survives the download
// being deleted.

export const SHORTCUT_NAME = "Batomon Match History";
const EXE_NAME = "BatomonMatchHistory.exe";

/** True when running as the packaged .exe rather than through node/tsx/bun. */
export function isPackaged(): boolean {
  return !/^(node|bun|tsx)(\.exe)?$/i.test(path.basename(process.execPath));
}

/** Runs a PowerShell script; values go through environment variables so nothing needs escaping. */
function powershell(script: string, env: Record<string, string>): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    windowsHide: true,
  }).trim();
}

export function openFile(file: string): void {
  if (process.platform === "win32") {
    powershell("Start-Process -FilePath $env:BMH_OPEN", { BMH_OPEN: file });
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [file], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

/**
 * Copies the running .exe into the data folder, unless it already runs from
 * there. That is also how an update gets installed: run the newly downloaded
 * .exe once. Returns the path the shortcut should point to.
 */
export function installedExe(): Promise<string> {
  return (installing ??= install());
}

let installing: Promise<string> | null = null;

async function install(): Promise<string> {
  const target = path.join(DATA_DIR, EXE_NAME);
  if (path.resolve(process.execPath).toLowerCase() === target.toLowerCase()) return target;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await copyFile(process.execPath, target);
    return target;
  } catch {
    // The installed copy may be open in another window; keep using this one.
    return process.execPath;
  }
}

/** Creates (or replaces) the desktop shortcut. Windows only. */
export async function createShortcut(): Promise<string> {
  const packaged = isPackaged();
  // From source, the shortcut runs `npm start` in the project folder.
  const target = packaged ? await installedExe() : process.env.ComSpec ?? "cmd.exe";
  const args = packaged ? "" : "/c npm start";
  const workdir = packaged ? path.dirname(target) : process.cwd();
  return powershell(
    `
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop "$env:BMH_NAME.lnk"
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
$s.TargetPath = $env:BMH_TARGET
if ($env:BMH_ARGS) { $s.Arguments = $env:BMH_ARGS }
$s.WorkingDirectory = $env:BMH_WORKDIR
$s.Description = 'Updates your Batomon Showdown match history and opens it'
$s.Save()
Write-Output $link
`,
    { BMH_NAME: SHORTCUT_NAME, BMH_TARGET: target, BMH_ARGS: args, BMH_WORKDIR: workdir },
  );
}
