import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./store";

// Operating system bits: opening the page, the app window, hiding the
// console, the desktop shortcut, and keeping a copy of the .exe next to the
// data so the shortcut survives the download being deleted.

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
$s.Description = 'Opens Batomon Match History: saves your runs while open, shows the best comps and trainers'
$s.Save()
Write-Output $link
`,
    { BMH_NAME: SHORTCUT_NAME, BMH_TARGET: target, BMH_ARGS: args, BMH_WORKDIR: workdir },
  );
}

/** Edge (part of Windows) or Chrome, which can open a page as an app window without browser bars. */
export function findBrowser(): string | null {
  if (process.platform !== "win32") return null;
  const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean) as string[];
  const apps = [path.join("Microsoft", "Edge", "Application", "msedge.exe"), path.join("Google", "Chrome", "Application", "chrome.exe")];
  for (const app of apps)
    for (const root of roots) {
      const file = path.join(root, app);
      if (existsSync(file)) return file;
    }
  return null;
}

/**
 * Opens the URL in its own window. With its own browser profile, the window
 * is a separate browser process that ends when the window is closed, so the
 * caller can wait for it. Without Edge or Chrome it opens a normal browser
 * tab and returns null.
 */
export function openAppWindow(url: string): ChildProcess | null {
  const browser = findBrowser();
  if (!browser) {
    openFile(url);
    return null;
  }
  const child = spawn(
    browser,
    [
      `--app=${url}`,
      `--user-data-dir=${path.join(DATA_DIR, "window")}`,
      "--window-size=1280,860",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore", windowsHide: false },
  );
  child.on("error", () => openFile(url));
  return child;
}

/**
 * Hides the console window when the .exe was started by double-clicking
 * (the console belongs to this process alone). Started from a terminal, the
 * console is shared and stays. Returns whether it was hidden.
 */
export async function hideOwnConsole(): Promise<boolean> {
  if (process.platform !== "win32" || !process.versions.bun) return false;
  try {
    const spec = "bun:ffi";
    const { dlopen, FFIType } = await import(spec);
    const lib = dlopen("kernel32.dll", {
      GetConsoleProcessList: { args: [FFIType.ptr, FFIType.u32], returns: FFIType.u32 },
      FreeConsole: { args: [], returns: FFIType.i32 },
    });
    const ids = new Uint32Array(4);
    const count = lib.symbols.GetConsoleProcessList(ids, ids.length);
    const hidden = count === 1 && lib.symbols.FreeConsole() !== 0;
    lib.close();
    return hidden;
  } catch {
    return false;
  }
}
