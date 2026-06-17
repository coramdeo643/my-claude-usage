*Read this in: [한국어](README.md)*

# My Claude Usage

An ultra-lightweight extension that puts your Claude Code usage (5-hour session and weekly) **right in the VS Code status bar**. See your remaining limits at a glance, zero clicks. It reuses **Claude Code's existing login** — no separate sign-in required.

<p align="center">
  <img src="dev.coramdeo_profile.png" alt="My Claude Usage icon" width="128">
</p>

## 📸 Preview

<p align="center">
  <img src="images/screenshot.png" alt="Usage and tooltip shown in the status bar" width="600">
</p>

## ✨ Why My Claude Usage?

Checking your Claude Code limits normally takes extra steps. This extension shows them **directly in your status bar**, always visible while you work.

- **Minimal**: shows just your 5-hour session usage, e.g. `Claude 5h: 20%`.
- **Color warnings**: turns yellow at 70%+ and red at 90%+ usage.
- **Clean tooltip**: hover to see 5h/7d usage and time until reset in two tidy lines.
- No heavy webviews or dashboards, no background overhead.

## 🔐 Auth & Privacy

It **automatically reads your existing Claude Code credentials** (location varies by OS):

- **macOS**: Keychain (`Claude Code-credentials`)
- **Windows / Linux**: `~/.claude/.credentials.json`
- or the `ANTHROPIC_API_KEY` environment variable (CI/container fallback)

The only network call goes to the **official Anthropic usage endpoint (`api.anthropic.com`)**, authenticated with your own token.

- No data sent to any third-party server
- No telemetry, no tracking
- Never creates or stores new tokens (it only reads Claude Code's existing login)
- **macOS note**: on first run macOS may show a Keychain access prompt → click **"Always Allow"**.

## 🪶 Ultra-Lightweight (~6 KB)

A single `esbuild` bundle keeps the whole extension at roughly 6 KB (even smaller compressed).

- Zero runtime dependencies beyond the VS Code API
- Activates only on `onStartupFinished` for instant load

## ✅ Requirements

- **Claude Code** must be installed and logged in (credentials must exist for usage to be read).

## ⚙️ Configuration

| Setting | Default | Description |
|---|---|---|
| `myClaudeUsage.refreshInterval` | `120` | Refresh interval in seconds (30-3600) |

## ⌨️ Commands

| Command | Keybinding | Description |
|---|---|---|
| `Claude Usage: Refresh Claude Usage` | `Ctrl/Cmd+Shift+R` | Refresh usage immediately |

Clicking the status bar item also refreshes immediately.

## 🚀 How to Install

1. Open the Extensions view in VS Code (`Ctrl+Shift+X`).
2. Search for **My Claude Usage**.
3. Click **Install**. That's it.

## 📄 License

[MIT License](LICENSE)
