import { createElement, insert, setProp } from "@opentui/solid"

const DEFAULT_PEAK_HOURS = { start: 9, end: 13, timeZone: "Europe/Moscow" }

function peakHours(options = {}) {
  return { ...DEFAULT_PEAK_HOURS, ...options.peakHours }
}

function rate(options = {}) {
  const hours = peakHours(options)
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: hours.timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  )

  return hour >= hours.start && hour < hours.end
    ? { label: "!!! Z.AI QUOTA 3x PEAK !!!", peak: true }
    : { label: "Z.AI quota: 1x", peak: false }
}

const tui = async (api, options) => {
  const timer = setInterval(() => api.renderer.requestRender(), 30_000)
  api.lifecycle.onDispose(() => clearInterval(timer))

  api.command.register(() => [
    {
      title: `Z.AI quota: ${rate(options).label}`,
      value: "zai-rate-indicator.status",
      category: "Status",
      hidden: false,
      onSelect: () => {
        const current = rate(options)
        api.ui.toast({
          variant: current.peak ? "warning" : "success",
          message: current.label,
          duration: 3000,
        })
      },
    },
  ])

  api.slots.register({
    order: 10,
    slots: {
      sidebar_content() {
        return indicatorBox(api, options)
      },
    },
  })
}

function indicatorBox(api, options) {
  const current = rate(options)
  const box = createElement("box")
  setProp(box, "width", "100%")
  setProp(box, "paddingLeft", 1)
  setProp(box, "paddingRight", 1)
  setProp(box, "border", current.peak)
  setProp(box, "borderColor", current.peak ? api.theme.current.error : api.theme.current.success)

  const text = createElement("text")
  setProp(text, "fg", current.peak ? api.theme.current.error : api.theme.current.success)
  setProp(text, "bold", current.peak)
  insert(text, current.label)
  insert(box, text)
  return box
}

export default {
  id: "opencode-zai-rate-indicator",
  tui,
}
