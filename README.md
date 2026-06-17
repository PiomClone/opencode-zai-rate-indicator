# opencode-zai-rate-indicator

OpenCode TUI plugin that shows current Z.AI / GLM quota multiplier status in the sidebar.

It is useful when you use Z.AI Coding Plan models and want a visible warning before spending requests during the peak pricing window.

Companion server guard: [opencode-zai-peak-guard](https://github.com/PiomClone/opencode-zai-peak-guard).

## Quick Install

```sh
opencode plugin git@github.com:PiomClone/opencode-zai-rate-indicator.git -g --force
```

Restart OpenCode/TUI after installing.

## What It Shows

Default peak window is `09:00-13:00 Europe/Moscow`. GLM-5.2 / GLM-5-Turbo are shown as `3x` during peak, `1x` off-peak until `2026-09-30`, and `2x` off-peak after that by default.

During peak it shows a red boxed indicator:

```text
Z.AI PEAK 3x
```

Outside peak it shows:

```text
Z.AI OFF-PEAK 1x until Sep 30
```

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

## Options

```jsonc
[
  "git@github.com:PiomClone/opencode-zai-rate-indicator.git",
  {
    "peakHours": { "start": 9, "end": 13, "timeZone": "Europe/Moscow" },
    "offPeakBenefitUntil": "2026-09-30"
  }
]
```

## Development

```sh
npm run check
```

## Keywords

OpenCode plugin, OpenCode TUI plugin, Z.AI, Z AI, GLM-5, GLM-5.2, Z.AI Coding Plan, peak pricing, off-peak quota, quota indicator.
