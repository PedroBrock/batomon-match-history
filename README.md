# Batomon Match History

A companion app for **Batomon Showdown**. Leave it open while you play:

- **Best comps right now**: a tier list (S/A/B/C) of the comps that do best for the top 2000 players, with their usual team and trainers. Type a Batomon or trainer you have to see which comps use it.
- **Trainers**: average badges, 10-badge rate and how often each trainer is picked when offered, next to your own numbers with it.
- **My history**: every ranked run you play is saved as soon as it ends, with your win rate, average badges, which comps, trainers and Batomon gain or lose you rank, your MMR over time, and more.

The game itself only remembers your last ~10 runs. This app saves each one, so your history keeps growing.

Available in **English** and **Português (Brasil)**, with a button to switch.

![The app](docs/screenshot.png)

> Unofficial fan-made tool, not affiliated with berrymint (the developer of Batomon Showdown). It reads the game's public but undocumented API, which may change or stop working at any time.

## Install (Windows)

1. Go to the [**Releases**](https://github.com/PedroBrock/batomon-match-history/releases/latest) page and download `BatomonMatchHistory.exe`.
2. Double-click it. Windows may show **"Windows protected your PC"** because the file is not digitally signed (signing costs money). Click **More info**, then **Run anyway**. The source code is all here if you want to check what it does.
3. The app opens in its own window. Type your in-game name (or your 15-character player ID), click your account, and keep "Create a desktop shortcut" ticked.

From then on, **open the "Batomon Match History" shortcut before playing** and leave the window open. While it is open it checks your profile every 2 minutes and saves each run when it ends. **Closing the window closes the app**; nothing keeps running in the background.

The window is Microsoft Edge (part of Windows) in app mode, with its own profile, so it does not touch your normal browser. Without Edge or Chrome it opens as a tab in your default browser.

### Tips

- The game API only shows the last ~10 runs of an account. With the app open while you play none get lost; otherwise open it **at least once every 10 runs**.
- The API only gives your *current* MMR. With the app open between runs, each run gets its own MMR change.
- Only ranked runs are saved. Abandoned runs are listed but left out of the averages.
- The comps and trainer stats are refreshed every 6 hours (see [How the data is read](#how-the-data-is-read)).

### Where your data lives

Everything stays on your computer, in `%LOCALAPPDATA%\BatomonMatchHistory` (paste that in the File Explorer address bar):

| File | What it is |
| --- | --- |
| `history.json` | All your saved runs and MMR checks |
| `config.json` | Your account and language |
| `index.html` | Your history as a single page you can open without the app |
| `meta.json` | The last comps and trainer stats downloaded |
| `BatomonMatchHistory.exe` | The copy the shortcut runs |
| `window\` | The app window's browser profile |
| `app.log` | What the app did (useful if something goes wrong) |

To move your history to another PC, copy `history.json` and drag it onto `BatomonMatchHistory.exe` there. It is merged with what is already saved.

### Update

Close the app, download the new `BatomonMatchHistory.exe` from Releases and run it once. It replaces the installed copy and your history is kept.

### Uninstall

Delete the desktop shortcut and the `%LOCALAPPDATA%\BatomonMatchHistory` folder.

## Command line

The .exe also takes commands (run it from a terminal):

```
BatomonMatchHistory.exe                 open the app window (saves runs while open)
BatomonMatchHistory.exe setup "Name"    pick the account (or use your player ID)
BatomonMatchHistory.exe sync            fetch new runs and rebuild the page
BatomonMatchHistory.exe report          rebuild the page only
BatomonMatchHistory.exe open            open the page
BatomonMatchHistory.exe shortcut        create the desktop shortcut
BatomonMatchHistory.exe lang pt-BR      change the language (en or pt-BR)
BatomonMatchHistory.exe import <file>   merge a history.json from elsewhere
```

## Run from source (macOS, Linux, or if you prefer)

Requires [Node.js](https://nodejs.org) 20 or newer.

```sh
git clone https://github.com/PedroBrock/batomon-match-history
cd batomon-match-history
npm install
npm start                  # same as double-clicking the .exe (opens the app in your browser)
npm start -- sync          # any command from the list above
```

On macOS the data goes to `~/Library/Application Support/BatomonMatchHistory`, on Linux to `~/.local/share/batomon-match-history`. Set `BMH_DATA_DIR` to use another folder.

## Development

```sh
npm test            # unit tests
npm run typecheck
npm run build:exe   # Windows .exe in dist/ (needs Bun: https://bun.sh)
```

| Path | What it does |
| --- | --- |
| `src/main.ts` | Entry point: commands, console messages |
| `src/app.ts` | The app: local web server on 127.0.0.1, checks every 2 minutes while the window is open, setup |
| `src/appPage.ts` | The app window: comps, trainers and history tabs, live updates |
| `src/api.ts` | Reads the game API and converts profiles, runs and trainer selections |
| `src/store.ts`, `src/sync.ts` | Data folder, settings, history and how new runs are merged |
| `src/stats.ts`, `src/comps.ts` | Win rate, badges, rank balance; comps grouped by 3 core Batomon |
| `src/meta.ts`, `src/metaClient.ts` | Comps tier list and trainer stats of the top players; downloading them |
| `scripts/collect-meta.ts` | Builds `meta.json` (run by the Meta stats workflow) |
| `src/report.ts` | The history page (one file, sprites inlined) |
| `src/i18n.ts` | All texts in English and Portuguese |
| `src/platform.ts` | Opening pages and the app window, hiding the console, the desktop shortcut, installing the .exe |

Releases are built by GitHub Actions: bump `version` in `package.json`, then run the **Release** workflow from the Actions tab (or push a tag like `v0.2.0`). It builds `BatomonMatchHistory.exe` with Bun and attaches it to a new release. Every pull request also builds the .exe as a downloadable artifact.

### How the data is read

The game backend (`api.batomon.app`) is a PocketBase server. The public `player_profiles` collection holds each account's rank, MMR, games, wins and its ~10 most recent runs (trainer, final team, round, badges, outcome). While open, the app reads your own profile once every 2 minutes (one small request) and identifies itself with a `User-Agent` that links to this repository. Profiles also contain the account's Steam ID; this tool never stores or shows it.

The comps and trainer stats are not collected by each app. The **Meta stats** workflow (`.github/workflows/meta.yml`) runs on GitHub Actions every 6 hours: it reads the top 2000 profiles of the season and the newest records of the public, anonymous `trainer_selections` collection (which trainers were offered and which one was picked), and publishes the aggregated `meta.json` on the [`meta-data`](https://github.com/PedroBrock/batomon-match-history/tree/meta-data) branch, which every app downloads. The runs it sees are kept between collections in an Actions cache (never published), so the stats cover the last 14 days.

Comps are grouped by a core of 3 Batomon. Each comp scores 70% share of 10-badge runs + 30% average badges; comps with 40+ runs from 25+ players get a tier by position: top 15% S, up to 40% A, up to 70% B, the rest C.

Ranked rules used for the stats: a run starts with 10 lives and ends at 0 lives or 10 badges; the rank changes by badges − 5 (5 keeps it, 6 is +1, 4 is −1).

## Credits

Batomon Showdown and all its artwork belong to berrymint.

## License

Source code under the [MIT License](LICENSE). Game sprites and data are not covered by it.
