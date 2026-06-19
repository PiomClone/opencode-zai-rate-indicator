# opencode-zai-rate-indicator

OpenCode TUI plugin that shows quota status for the provider used by the active session.

Supported providers:

- Z.AI Coding Plan: peak/off-peak multiplier and 5-hour/weekly quota
- Kimi for Coding: 5-hour/weekly quota
- MiniMax Coding Plan: 5-hour/weekly quota

The active provider is detected from the current session model. Switching models refreshes the displayed quota automatically.

Companion server guard: [opencode-zai-peak-guard](https://github.com/PiomClone/opencode-zai-peak-guard).

## Quick Install

For now the most reliable TUI setup is a local checkout:

```sh
git clone git@github.com:PiomClone/opencode-zai-rate-indicator.git ~/.config/opencode/plugins/opencode-zai-rate-indicator
opencode plugin file://$HOME/.config/opencode/plugins/opencode-zai-rate-indicator -g --force
```

Restart OpenCode/TUI after installing.

## What It Shows

Default peak window is `09:00-13:00 Europe/Moscow`. GLM-5.2 / GLM-5-Turbo are shown as `3x` during peak, `1x` off-peak until `2026-09-30`, and `2x` off-peak after that by default. The indicator is shown only in the active session sidebar.

The plugin reads provider credentials from OpenCode auth and fetches the corresponding subscription quota.

Z.AI sidebar indicator:

```text
Z.AI 3x PEAK
5h 42% 14:03 · W 18%
```

If quota fetching fails, it silently falls back to the multiplier-only indicator.

Kimi and MiniMax show the provider name and available quota windows without a pricing multiplier. Unsupported providers show `No quota provider`.

## Install

From GitHub:

```sh
opencode plugin git@github.com:PiomClone/opencode-zai-rate-indicator.git -g --force
```

From a local checkout:

```sh
opencode plugin file://$(pwd) -g --force
```

This writes to `~/.config/opencode/tui.json`.
On OpenCode versions that support `opencode plugin`, the package entrypoint is the TUI plugin itself.

Example global TUI config:

```json
{
  "plugin": [
    "file:///Users/me/.config/opencode/plugins/opencode-zai-rate-indicator"
  ]
}
```

## Options

```jsonc
[
  "git@github.com:PiomClone/opencode-zai-rate-indicator.git",
  {
    "peakHours": { "start": 9, "end": 13, "timeZone": "Europe/Moscow" },
    "offPeakBenefitUntil": "2026-09-30",
    "authKeys": {
      "zai": "zai-coding-plan",
      "kimi": "kimi-for-coding",
      "minimax": "minimax-coding-plan"
    },
    "quotaRefreshMs": 300000,
    "showQuota": true,
    "showIndicator": true
  }
]
```

## Commands

The command palette includes one runtime toggle:

```text
Quota indicator: hide/show
```

This toggle applies to the current TUI process only. Use config options for persistent defaults:

```jsonc
{
  "showIndicator": true
}
```

## Development

```sh
npm run check
```

## Keywords

OpenCode plugin, OpenCode TUI plugin, Z.AI, Kimi, MiniMax, GLM-5, Z.AI Coding Plan, peak pricing, quota indicator.
