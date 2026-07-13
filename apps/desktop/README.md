# RuyiHermesAgent Desktop

<p align="center">
  <a href="https://github.com/DaPengRuYi/RuyiHermesAgent/releases"><img src="https://img.shields.io/badge/Download-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-FFD700?style=for-the-badge" alt="Download"></a>
  <a href="https://hermes-agent.nousresearch.com/docs/"><img src="https://img.shields.io/badge/Docs-hermes--agent.nousresearch.com-FFD700?style=for-the-badge" alt="Documentation"></a>
  <a href="https://discord.gg/NousResearch"><img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://github.com/NousResearch/hermes-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
</p>

**RuyiHermesAgent（如意智能体）is the branded native desktop app powered by the Hermes agent runtime from [Nous Research](https://nousresearch.com).** It uses the same `hermes` CLI, skills, memory, config, and gateway, in a polished native window. Available for **macOS, Windows, and Linux**.

<table>
<tr><td><b>Chat with the full agent</b></td><td>Streaming responses, live tool activity, structured tool summaries, and the same conversation history as every other Hermes surface.</td></tr>
<tr><td><b>Side-by-side previews</b></td><td>Render web pages, files, and tool outputs in a right-hand pane while you keep chatting.</td></tr>
<tr><td><b>File browser</b></td><td>Explore and preview the working directory without leaving the app.</td></tr>
<tr><td><b>Voice</b></td><td>Talk to Hermes and hear it back.</td></tr>
<tr><td><b>Settings & onboarding</b></td><td>Manage providers, models, tools, and credentials from a real UI. First-run setup gets you to your first message in seconds.</td></tr>
<tr><td><b>Stays current</b></td><td>Built-in updates pull the latest agent and rebuild the app in place.</td></tr>
</table>

---

## Install

### Install with the `hermes` CLI

Already have the `hermes` CLI? Just run:

```bash
hermes desktop
```

It builds and launches RuyiHermesAgent against your existing install — same config, keys, sessions, and skills.

### Prebuilt installers

Prebuilt installers are built and distributed via [the Hermes Desktop website.](https://hermes-agent.nousresearch.com/).

---

## Updating

The app checks for updates in the background and offers a one-click update when one is ready. You can also update any time from the CLI:

```bash
hermes update
```

---

## Requirements

The installer handles everything for you (Python 3.11+, a portable Git, ripgrep).

---

## Development

Want to hack on the app itself? Install workspace deps from the repo root once, then run the dev server from this directory:

```bash
npm install          # from repo root — links apps/desktop, web, apps/shared
cd apps/desktop
npm run dev          # Vite renderer + Electron, which boots the Python backend
```

Point the app at a specific source checkout, or sandbox it away from your real config:

```bash
HERMES_DESKTOP_HERMES_ROOT=/path/to/clone npm run dev
HERMES_HOME=/tmp/throwaway npm run dev
npm run dev:fake-boot   # exercise the startup overlay with deterministic delays
```

### Windows: verified student packaging path

Run these two commands from the repository root:

```powershell
npm ci
npm run desktop:package:win
```

The second command runs desktop type checks, platform and UI tests, packaging-contract tests, verifies that the pinned `install.ps1` and `install.sh` are reachable from the fork, requires a clean tracked worktree, builds the NSIS installer, validates the packaged app payload, and performs an isolated silent install/uninstall smoke test without launching the app. The smoke test refuses to run when it detects an existing compatible installation, process, shortcut, default install directory, or non-empty updater cache, so it cannot overwrite a developer's real install. The installer is written to:

```text
apps\desktop\release\RuyiHermesAgent-<version>-win-<arch>.exe
```

Double-click that file to install the desktop product. The product is named **RuyiHermesAgent** (中文：**如意智能体**); its command-line tool intentionally remains `hermes`.

To build the Windows green portable edition instead, run:

```powershell
npm ci
npm run desktop:package:portable:win
```

The single-file executable is written to `apps\desktop\release\RuyiHermesAgent-Portable-<version>-<arch>.exe`. Put it in its own writable folder before launching. It stores desktop settings and the managed `hermes` runtime in an adjacent `data` folder, does not create an uninstall entry or shortcuts, and does not claim the `hermes://` protocol. To remove it, exit the app and delete the executable plus `data` folder.

Release packaging fails when the current commit has not been pushed to the configured GitHub `origin`. This is intentional: a locally successful installer whose pinned bootstrap scripts return 404 is not safe to hand to students.

### Other build targets

```bash
npm run dist:mac     # DMG + zip
npm run dist:win     # NSIS + MSI
npm run dist:linux   # AppImage + deb + rpm
npm run pack         # unpacked app under release/ (no installer)
```

Installers are built and uploaded to GitHub Releases manually. macOS/Windows signing & notarization happen automatically when the relevant credentials are present in the environment (`CSC_LINK` / `CSC_KEY_PASSWORD` / `APPLE_*` for macOS, `WIN_CSC_*` for Windows).

### How it works

The packaged app ships the Electron shell and a native React chat surface. On first launch it can install the Hermes Agent runtime into `HERMES_HOME` (`~/.hermes`, or `%LOCALAPPDATA%\hermes` on Windows) — the **same layout a CLI install uses**, so the two are interchangeable. Backend resolution first honours `HERMES_DESKTOP_HERMES_ROOT`, then a completed managed install, then a probed `hermes` on `PATH` (unless `HERMES_DESKTOP_IGNORE_EXISTING=1` is set), and finally an explicit `HERMES_DESKTOP_HERMES` command override for packagers/troubleshooting. The renderer (React, in `src/`) talks to a headless backend the app launches for you — a `hermes serve` process that serves the `tui_gateway` JSON-RPC/WebSocket API — through the framework-agnostic client in [`apps/shared`](../shared/) (the same client the web dashboard consumes), and reuses the agent runtime rather than embedding `hermes --tui`. The app is **self-contained**: it runs its own `hermes serve` backend and never opens or requires the web dashboard UI. (For backward compatibility, a runtime that predates the `serve` command automatically falls back to a headless `dashboard --no-open` — see `electron/backend-command.ts` — so mid-upgrade installs never break.) The install, backend-resolution, and self-update logic all live in `electron/main.ts`.

### Verification

Run before opening a PR (lint may surface pre-existing warnings but must exit cleanly):

```bash
npm run fix
npm run typecheck
npm run lint
npm run test:desktop:all
```

### Troubleshooting

Boot logs land in `HERMES_HOME/logs/desktop.log` (includes backend output and recent Python tracebacks) — check it first if the app reports a boot failure.

**macOS / Linux:**

```bash
# Force a clean first-launch setup
rm "$HOME/.hermes/hermes-agent/.hermes-bootstrap-complete"
# Rebuild a broken Python venv
rm -rf "$HOME/.hermes/hermes-agent/venv"
# Reset a stuck macOS microphone prompt (macOS only)
tccutil reset Microphone com.nousresearch.hermes
```

**Windows (PowerShell):**

```powershell
# Force a clean first-launch setup
Remove-Item "$env:LOCALAPPDATA\hermes\hermes-agent\.hermes-bootstrap-complete"
# Rebuild a broken Python venv
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\hermes\hermes-agent\venv"
```

> The default Hermes home on Windows is `%LOCALAPPDATA%\hermes`. Set the `HERMES_HOME` env var if you've relocated it.

---

## Community

- 💬 [Discord](https://discord.gg/NousResearch)
- 📖 [Documentation](https://hermes-agent.nousresearch.com/docs/)
- 🐛 [Issues](https://github.com/NousResearch/hermes-agent/issues)

---

## License

MIT — see [LICENSE](../../LICENSE).

Built by [Nous Research](https://nousresearch.com).
