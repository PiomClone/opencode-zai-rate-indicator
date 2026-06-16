# opencode-zai-rate-indicator

OpenCode TUI plugin that shows current Z.AI quota status in the sidebar.

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

```sh
opencode plugin file://$(pwd) -g --force
```

This writes to `~/.config/opencode/tui.json`.

## Options

```jsonc
[
  "file:///Users/avkorkin/prj/opencode/plugins/opencode-zai-rate-indicator",
  {
    "peakHours": { "start": 9, "end": 13, "timeZone": "Europe/Moscow" }
  }
]
```

## Development

```sh
npm run check
```
