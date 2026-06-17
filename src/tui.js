import { createElement, insert, setProp } from "@opentui/solid"
import { readFile } from "node:fs/promises"

const DEFAULT_PEAK_HOURS = { start: 9, end: 13, timeZone: "Europe/Moscow" }
const DEFAULT_OFF_PEAK_BENEFIT_UNTIL = "2026-09-30"
const DEFAULT_AUTH_KEY = "zai-coding-plan"
const DEFAULT_QUOTA_REFRESH_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000

const quota = {
  loading: false,
  result: null,
  error: null,
  updatedAt: 0,
}

const display = {
  home: true,
  sidebar: true,
  quotaDetails: true,
}

function settings(options = {}) {
  return {
    peakHours: { ...DEFAULT_PEAK_HOURS, ...options.peakHours },
    offPeakBenefitUntil: options.offPeakBenefitUntil ?? DEFAULT_OFF_PEAK_BENEFIT_UNTIL,
    authKey: options.authKey ?? DEFAULT_AUTH_KEY,
    quotaRefreshMs: options.quotaRefreshMs ?? DEFAULT_QUOTA_REFRESH_MS,
    showQuota: options.showQuota !== false,
    showHome: options.showHome !== false,
    showSidebar: options.showSidebar !== false,
    showQuotaDetails: options.showQuotaDetails !== false,
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
  const currentSettings = settings(options)
  display.home = currentSettings.showHome
  display.sidebar = currentSettings.showSidebar
  display.quotaDetails = currentSettings.showQuotaDetails
  refreshQuota(api, currentSettings)
  const quotaTimer = setInterval(() => refreshQuota(api, currentSettings), currentSettings.quotaRefreshMs)
  const timer = setInterval(() => api.renderer.requestRender(), 30_000)
  api.lifecycle.onDispose(() => {
    clearInterval(timer)
    clearInterval(quotaTimer)
  })

  api.command?.register?.(() => [
    {
      title: `Z.AI quota: ${indicatorLabel(options)}`,
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
    {
      title: `Z.AI quota: ${display.sidebar ? "hide" : "show"} sidebar`,
      value: "zai-rate-indicator.toggle-sidebar",
      category: "Status",
      hidden: false,
      onSelect: () => {
        display.sidebar = !display.sidebar
        api.renderer.requestRender()
        api.ui.toast({
          variant: "info",
          message: `Z.AI quota sidebar ${display.sidebar ? "shown" : "hidden"}`,
          duration: 2000,
        })
      },
    },
    {
      title: `Z.AI quota: ${display.home ? "hide" : "show"} home banner`,
      value: "zai-rate-indicator.toggle-home",
      category: "Status",
      hidden: false,
      onSelect: () => {
        display.home = !display.home
        api.renderer.requestRender()
        api.ui.toast({
          variant: "info",
          message: `Z.AI quota home banner ${display.home ? "shown" : "hidden"}`,
          duration: 2000,
        })
      },
    },
    {
      title: `Z.AI quota: ${display.quotaDetails ? "hide" : "show"} quota details`,
      value: "zai-rate-indicator.toggle-quota-details",
      category: "Status",
      hidden: false,
      onSelect: () => {
        display.quotaDetails = !display.quotaDetails
        api.renderer.requestRender()
        api.ui.toast({
          variant: "info",
          message: `Z.AI quota details ${display.quotaDetails ? "shown" : "hidden"}`,
          duration: 2000,
        })
      },
    },
  ])

  api.slots.register({
    order: 10,
    slots: {
      home_bottom() {
        if (!display.home) return undefined
        return indicatorBox(api, options)
      },
      sidebar_content() {
        if (!display.sidebar) return undefined
        return indicatorBox(api, options)
      },
    },
  })
  api.renderer.requestRender()
}

async function refreshQuota(api, options) {
  if (!options.showQuota || quota.loading) return
  quota.loading = true
  try {
    quota.result = await fetchZaiQuota(options.authKey)
    quota.error = null
    quota.updatedAt = Date.now()
    api.renderer.requestRender()
  } catch (error) {
    quota.error = error
  } finally {
    quota.loading = false
  }
}

async function fetchZaiQuota(authKey) {
  const apiKey = await getAuthKey(authKey)
  if (!apiKey) return null

  const res = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
    headers: {
      Authorization: apiKey,
      "Accept-Language": "en-US,en",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) return null

  const json = await res.json()
  const tokenLimits = (json.data?.limits ?? []).filter((limit) => limit.type === "TOKENS_LIMIT")
  if (tokenLimits.length === 0) return null

  return {
    level: json.data?.level ?? "?",
    fiveHour: formatWindow("5h", tokenLimits[0]),
    week: formatWindow("week", tokenLimits[1]),
  }
}

async function getAuthKey(provider) {
  try {
    const text = await readFile(`${process.env.HOME}/.local/share/opencode/auth.json`, "utf8")
    return JSON.parse(text)[provider]?.key ?? null
  } catch {
    return null
  }
}

function formatWindow(name, limit) {
  if (!limit) return null
  const usedPct = Math.round(limit.percentage ?? limit.usage ?? 0)
  return {
    name,
    usedPct,
    reset: formatResetTime(limit.nextResetTime),
  }
}

function formatResetTime(epochMs) {
  if (!epochMs) return null
  const value = epochMs < 1_000_000_000_000 ? epochMs * 1000 : epochMs
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function indicatorLabel(options) {
  const current = rate(options)
  if (!display.quotaDetails || !quota.result) return current.label

  const parts = [`${current.label}`, `plan ${quota.result.level}`]
  if (quota.result.fiveHour) {
    const reset = quota.result.fiveHour.reset ? ` reset ${quota.result.fiveHour.reset}` : ""
    parts.push(`5h ${quota.result.fiveHour.usedPct}%${reset}`)
  }
  if (quota.result.week) {
    parts.push(`week ${quota.result.week.usedPct}%`)
  }
  return parts.join(" · ")
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
  insert(text, indicatorLabel(options))
  insert(box, text)
  return box
}

export default {
  id: "opencode-zai-rate-indicator",
  tui,
}
