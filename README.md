# opencode-zai-rate-indicator

OpenCode TUI plugin that shows current Z.AI / GLM quota multiplier and subscription quota status.

It is useful when you use Z.AI Coding Plan models and want a visible warning before spending requests during the peak pricing window.

Companion server guard: [opencode-zai-peak-guard](https://github.com/PiomClone/opencode-zai-peak-guard).

## Quick Install

For now the most reliable TUI setup is a local checkout:

```sh
git clone git@github.com:PiomClone/opencode-zai-rate-indicator.git ~/.config/opencode/plugins/opencode-zai-rate-indicator
opencode plugin file://$HOME/.config/opencode/plugins/opencode-zai-rate-indicator -g --force
```

Restart OpenCode/TUI after installing.

## What It Shows

Default peak window is `09:00-13:00 Europe/Moscow`. GLM-5.2 / GLM-5-Turbo are shown as `3x` during peak, `1x` off-peak until `2026-09-30`, and `2x` off-peak after that by default.

If the Z.AI key is available in OpenCode auth as `zai-coding-plan`, the plugin also fetches real subscription quota usage from Z.AI.

Home/sidebar indicator:

```text
Z.AI 3x PEAK
5h 42% · week 18%
```

Bottom quota line:

```text
Z.AI quota: 5h 42% reset 14:03 · week 18%
```

If quota fetching fails, it silently falls back to the multiplier-only indicator.

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
    "authKey": "zai-coding-plan",
    "quotaRefreshMs": 300000,
    "showQuota": true,
    "showIndicator": true,
    "showBottomQuota": true
  }
]
```

## Commands

The command palette includes one runtime toggle:

```text
Z.AI quota: hide/show indicator
```

This toggle applies to the current TUI process only. Use config options for persistent defaults:

```jsonc
{
  "showIndicator": true,
  "showBottomQuota": true
}
```

## Development

```sh
npm run check
```

## Keywords

OpenCode plugin, OpenCode TUI plugin, Z.AI, Z AI, GLM-5, GLM-5.2, Z.AI Coding Plan, peak pricing, off-peak quota, quota indicator.
