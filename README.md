# opencode-zai-rate-indicator

OpenCode TUI plugin that shows current Z.AI / GLM quota status in the sidebar.

It is useful when you use Z.AI Coding Plan models and want a visible warning before spending requests during the peak pricing window.

Companion server guard: [opencode-zai-peak-guard](https://github.com/PiomClone/opencode-zai-peak-guard).

## Quick Install

```sh
opencode plugin git@github.com:PiomClone/opencode-zai-rate-indicator.git -g --force
```

Restart OpenCode/TUI after installing.

## What It Shows

Default peak window is `09:00-13:00 Europe/Moscow`.

During peak it shows a red boxed indicator:

```text
!!! Z.AI QUOTA 3x PEAK !!!
```

Outside peak it shows:

```text
Z.AI quota: 1x
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

## Options

```jsonc
[
  "git@github.com:PiomClone/opencode-zai-rate-indicator.git",
  {
    "peakHours": { "start": 9, "end": 13, "timeZone": "Europe/Moscow" }
  }
]
```

## Development

```sh
npm run check
```

## Keywords

OpenCode plugin, OpenCode TUI plugin, Z.AI, Z AI, GLM-5, GLM-5.2, Z.AI Coding Plan, peak pricing, quota indicator.
