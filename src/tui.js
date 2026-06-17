import { createElement, insert, setProp } from "@opentui/solid"

const DEFAULT_PEAK_HOURS = { start: 9, end: 13, timeZone: "Europe/Moscow" }
const DEFAULT_OFF_PEAK_BENEFIT_UNTIL = "2026-09-30"

function settings(options = {}) {
  return {
    peakHours: { ...DEFAULT_PEAK_HOURS, ...options.peakHours },
    offPeakBenefitUntil: options.offPeakBenefitUntil ?? DEFAULT_OFF_PEAK_BENEFIT_UNTIL,
  }
}

function dateKeyInTimeZone(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function rate(options = {}) {
  const currentSettings = settings(options)
  const hours = currentSettings.peakHours
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: hours.timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  )

  if (hour >= hours.start && hour < hours.end) {
    return { label: "Z.AI PEAK 3x", peak: true }
  }

  const benefitActive = dateKeyInTimeZone(hours.timeZone) <= currentSettings.offPeakBenefitUntil
  return benefitActive
    ? { label: "Z.AI OFF-PEAK 1x until Sep 30", peak: false }
    : { label: "Z.AI OFF-PEAK 2x", peak: false }
}

const tui = async (api, options) => {
  const timer = setInterval(() => api.renderer.requestRender(), 30_000)
  api.lifecycle.onDispose(() => clearInterval(timer))

  api.command?.register?.(() => [
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
      home_bottom() {
        return indicatorBox(api, options)
      },
      sidebar_content() {
        return indicatorBox(api, options)
      },
    },
  })
  api.renderer.requestRender()
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
