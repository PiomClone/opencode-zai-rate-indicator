import { createElement, insert, setProp } from "@opentui/solid"
import { readFile } from "node:fs/promises"
import { createSignal } from "solid-js"

const DEFAULT_PEAK_HOURS = { start: 9, end: 13, timeZone: "Europe/Moscow" }
const DEFAULT_OFF_PEAK_BENEFIT_UNTIL = "2026-09-30"
const DEFAULT_AUTH_KEY = "zai-coding-plan"
const DEFAULT_QUOTA_REFRESH_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000

const quota = {
  loading: false,
  error: null,
  updatedAt: 0,
}

function settings(options = {}) {
  return {
    peakHours: { ...DEFAULT_PEAK_HOURS, ...options.peakHours },
    offPeakBenefitUntil: options.offPeakBenefitUntil ?? DEFAULT_OFF_PEAK_BENEFIT_UNTIL,
    authKey: options.authKey ?? DEFAULT_AUTH_KEY,
    quotaRefreshMs: options.quotaRefreshMs ?? DEFAULT_QUOTA_REFRESH_MS,
    showQuota: options.showQuota !== false,
    showIndicator: options.showIndicator !== false,
    showBottomQuota: options.showBottomQuota !== false,
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
    ? { label: "Z.AI 1x OFF-PEAK", detail: "until Sep 30", peak: false }
    : { label: "Z.AI 2x OFF-PEAK", detail: "", peak: false }
}

const tui = async (api, options) => {
  const currentSettings = settings(options)
  const [visible, setVisible] = createSignal(currentSettings.showIndicator)
  const [quotaResult, setQuotaResult] = createSignal(null)

  refreshQuota(api, currentSettings, setQuotaResult)
  const quotaTimer = setInterval(() => refreshQuota(api, currentSettings, setQuotaResult), currentSettings.quotaRefreshMs)
  const timer = setInterval(() => api.renderer.requestRender(), 30_000)
  api.lifecycle.onDispose(() => {
    clearInterval(timer)
    clearInterval(quotaTimer)
  })

  api.command?.register?.(() => [
    {
      title: `Z.AI quota: ${visible() ? "hide" : "show"} indicator`,
      value: "zai-rate-indicator.toggle",
      category: "Status",
      hidden: false,
      onSelect: () => {
        setVisible(!visible())
        api.renderer.requestRender()
        api.ui.toast({
          variant: visible() ? "success" : "info",
          message: `Z.AI quota indicator ${visible() ? "shown" : "hidden"}`,
          duration: 2000,
        })
      },
    },
  ])

  api.slots.register({
    order: 10,
    slots: {
      home_bottom() {
        return indicatorBox(api, options, "home", visible)
      },
      app_bottom() {
        return bottomQuotaBox(api, currentSettings, visible, quotaResult)
      },
      sidebar_content() {
        return indicatorBox(api, options, "sidebar", visible)
      },
    },
  })
  api.renderer.requestRender()
}

async function refreshQuota(api, options, setQuotaResult) {
  if (!options.showQuota || quota.loading) return
  quota.loading = true
  try {
    setQuotaResult(await fetchZaiQuota(options.authKey))
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

function indicatorLines(options, context) {
  const current = rate(options)
  return [context === "home" && current.detail ? `${current.label} ${current.detail}` : current.label]
}

function bottomQuotaBox(api, options, visible, quotaResult) {
  const box = createElement("box")
  setProp(box, "width", "100%")
  setProp(box, "paddingLeft", 1)
  setProp(box, "paddingRight", 1)

  const text = createElement("text")
  setProp(text, "fg", api.theme.current.textMuted ?? api.theme.current.text)
  insert(text, () => (visible() && options.showBottomQuota ? bottomQuotaLabel(quotaResult()) : " "))
  insert(box, text)
  return box
}

function bottomQuotaLabel(result) {
  if (!result) return " "

  const parts = []
  if (result.fiveHour) {
    const reset = result.fiveHour.reset ? ` reset ${result.fiveHour.reset}` : ""
    parts.push(`5h ${result.fiveHour.usedPct}%${reset}`)
  }
  if (result.week) {
    parts.push(`week ${result.week.usedPct}%`)
  }
  return parts.length > 0 ? `Z.AI quota: ${parts.join(" · ")}` : " "
}

function indicatorBox(api, options, context, visible) {
  const current = rate(options)
  const box = createElement("box")
  setProp(box, "width", "100%")
  setProp(box, "paddingLeft", 1)
  setProp(box, "paddingRight", 1)
  if (current.peak) {
    setProp(box, "border", true)
    setProp(box, "borderColor", api.theme.current.error)
  }

  const text = createElement("text")
  setProp(text, "fg", current.peak ? api.theme.current.error : api.theme.current.success)
  setProp(text, "bold", current.peak)
  insert(text, () => (visible() ? indicatorLines(options, context).join("\n") : " "))
  insert(box, text)
  return box
}

export default {
  id: "opencode-zai-rate-indicator",
  tui,
}
