import { createElement, insert, setProp } from "@opentui/solid";
import { readFile } from "node:fs/promises";
import { createSignal } from "solid-js";
const DEFAULT_PEAK_HOURS = { start: 9, end: 13, timeZone: "Europe/Moscow" };
const DEFAULT_OFF_PEAK_BENEFIT_UNTIL = "2026-09-30";
const DEFAULT_QUOTA_REFRESH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1e4;
const AUTH_PATH = `${process.env.HOME}/.local/share/opencode/auth.json`;
function settings(options = {}) {
  return {
    peakHours: { ...DEFAULT_PEAK_HOURS, ...options.peakHours },
    offPeakBenefitUntil: options.offPeakBenefitUntil ?? DEFAULT_OFF_PEAK_BENEFIT_UNTIL,
    authKeys: { ...options.authKeys },
    quotaRefreshMs: options.quotaRefreshMs ?? DEFAULT_QUOTA_REFRESH_MS,
    showQuota: options.showQuota !== false,
    showIndicator: options.showIndicator !== false
  };
}
function authKeyFor(s, provider) {
  return s.authKeys[provider.id] ?? provider.authKey;
}
async function getAuthKey(provider) {
  try {
    const text = await readFile(AUTH_PATH, "utf8");
    return JSON.parse(text)[provider]?.key ?? null;
  } catch {
    return null;
  }
}
async function fetchZai(apiKey) {
  const res = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
    headers: {
      Authorization: apiKey,
      "Accept-Language": "en-US,en",
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok)
    return null;
  const json = await res.json();
  const tokenLimits = (json.data?.limits ?? []).filter((l) => l.type === "TOKENS_LIMIT");
  return {
    label: `z.ai ${json.data?.level ?? "?"}`,
    windows: [
      {
        name: "5h",
        usedPct: tokenLimits[0]?.percentage ?? 0,
        resetEpochMs: tokenLimits[0]?.nextResetTime
      },
      { name: "week", usedPct: tokenLimits[1]?.percentage ?? 0 }
    ]
  };
}
async function fetchKimi(apiKey) {
  try {
    const res = await fetch("https://api.kimi.com/coding/v1/usages", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "KimiCLI/1.35"
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!res.ok)
      return null;
    const json = await res.json();
    const windows = [];
    const fiveHour = (json.limits ?? []).find((l) => l.window?.duration === 300 && /MINUTE/i.test(l.window?.timeUnit ?? ""));
    if (fiveHour?.detail) {
      const d = fiveHour.detail;
      const limit = parseFloat(d.limit ?? "0");
      const remaining = parseFloat(d.remaining ?? "0");
      if (limit > 0) {
        windows.push({
          name: "5h",
          usedPct: Math.round((limit - remaining) / limit * 100),
          resetEpochMs: d.resetTime ? Date.parse(d.resetTime) : undefined
        });
      }
    }
    if (json.usage) {
      const limit = parseFloat(json.usage.limit ?? "0");
      const used = parseFloat(json.usage.used ?? "0");
      const remaining = parseFloat(json.usage.remaining ?? "0");
      if (limit > 0) {
        const usedPct = used > 0 ? Math.round(used / limit * 100) : Math.round((limit - remaining) / limit * 100);
        windows.push({ name: "week", usedPct });
      }
    }
    if (windows.length === 0)
      return null;
    return { label: "Kimi Code", windows };
  } catch {
    return null;
  }
}
async function fetchMinimax(apiKey) {
  const res = await fetch("https://www.minimax.io/v1/token_plan/remains", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok)
    return null;
  const json = await res.json();
  const remains = json.model_remains ?? [];
  const r = remains.find((m) => m.model_name === "general") ?? remains[0];
  if (!r)
    return null;
  const intervalPct = r.current_interval_remaining_percent ?? 100;
  const weeklyPct = r.current_weekly_remaining_percent ?? 100;
  return {
    label: "MiniMax",
    windows: [
      {
        name: "5h",
        usedPct: Math.max(0, 100 - intervalPct),
        resetEpochMs: r.end_time
      },
      { name: "week", usedPct: Math.max(0, 100 - weeklyPct) }
    ]
  };
}
const PROVIDERS = [
  { id: "zai", authKey: "zai-coding-plan", match: /zai/i, fetch: fetchZai },
  { id: "kimi", authKey: "kimi-for-coding", match: /kimi|moonshot/i, fetch: fetchKimi },
  { id: "minimax", authKey: "minimax-coding-plan", match: /minimax/i, fetch: fetchMinimax }
];
function findProvider(providerID) {
  if (!providerID)
    return null;
  return PROVIDERS.find((p) => p.match.test(providerID)) ?? null;
}
function dateKeyInTimeZone(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date);
}
function zaiRate(s) {
  const hours = s.peakHours;
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: hours.timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).format(new Date));
  if (hour >= hours.start && hour < hours.end) {
    return { label: "Z.AI PEAK 3x", peak: true };
  }
  const benefitActive = dateKeyInTimeZone(hours.timeZone) <= s.offPeakBenefitUntil;
  return benefitActive ? { label: "Z.AI 1x OFF-PEAK", detail: "until Sep 30", peak: false } : { label: "Z.AI 2x OFF-PEAK", peak: false };
}
function formatResetTime(epochMs) {
  if (!epochMs)
    return "";
  const value = epochMs < 1000000000000 ? epochMs * 1000 : epochMs;
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function quotaLine(r) {
  if (!r)
    return "";
  const parts = r.windows.map((w) => {
    const reset = w.resetEpochMs ? ` ${formatResetTime(w.resetEpochMs)}` : "";
    const label = w.name === "week" ? "W" : w.name;
    return `${label} ${w.usedPct}%${reset}`;
  });
  return parts.join(" · ");
}
const quota = { loading: false, error: null, updatedAt: 0 };
async function refreshQuota(s, provider, setQuotaResult, api) {
  if (!s.showQuota || !provider || quota.loading)
    return;
  quota.loading = true;
  try {
    const apiKey = await getAuthKey(authKeyFor(s, provider));
    if (!apiKey) {
      setQuotaResult(null);
      return;
    }
    setQuotaResult(await provider.fetch(apiKey));
    quota.error = null;
    quota.updatedAt = Date.now();
    api.renderer.requestRender();
  } catch (error) {
    quota.error = error;
  } finally {
    quota.loading = false;
  }
}
function hasSupportedProvider(providers) {
  if (!providers)
    return true;
  const ids = providers.map((p) => p.id ?? "").join(" ").toLowerCase();
  return PROVIDERS.some((p) => p.match.test(ids));
}
const tui = async (api, options) => {
  if (!hasSupportedProvider(api.state.provider))
    return;
  const s = settings(options ?? {});
  const [visible, setVisible] = createSignal(s.showIndicator);
  const [activeProvider, setActiveProvider] = createSignal(null);
  const [quotaResult, setQuotaResult] = createSignal(null);
  let currentSessionID = null;
  function handleProviderChange(providerID) {
    const next = findProvider(providerID);
    if (next?.id !== activeProvider()?.id) {
      setActiveProvider(next);
      setQuotaResult(null);
      refreshQuota(s, next, setQuotaResult, api);
    }
  }
  const offSessionUpdated = api.event.on("session.updated", (e) => {
    if (e.properties.sessionID !== currentSessionID)
      return;
    handleProviderChange(e.properties.info.model?.providerID ?? "");
  });
  const offModelSwitched = api.event.on("session.next.model.switched", (e) => {
    if (e.properties.sessionID !== currentSessionID)
      return;
    handleProviderChange(e.properties.model.providerID);
  });
  const quotaTimer = setInterval(() => {
    refreshQuota(s, activeProvider(), setQuotaResult, api);
  }, s.quotaRefreshMs);
  const timer = setInterval(() => api.renderer.requestRender(), 30000);
  const unregisterCommand = api.command?.register(() => [
    {
      title: `Quota indicator: ${visible() ? "hide" : "show"}`,
      value: "quota-indicator.toggle",
      category: "Status",
      hidden: false,
      onSelect: () => {
        setVisible(!visible());
        api.renderer.requestRender();
        api.ui.toast({
          variant: visible() ? "success" : "info",
          message: `Quota indicator ${visible() ? "shown" : "hidden"}`,
          duration: 2000
        });
      }
    }
  ]);
  api.lifecycle.onDispose(() => {
    unregisterCommand?.();
    offSessionUpdated();
    offModelSwitched();
    clearInterval(timer);
    clearInterval(quotaTimer);
  });
  api.slots.register({
    order: 10,
    slots: {
      sidebar_content: (_ctx, props) => {
        const sid = props?.session_id ?? null;
        if (sid && sid !== currentSessionID) {
          currentSessionID = sid;
          const pid = api.state.session.get(sid)?.model?.providerID ?? "";
          handleProviderChange(pid);
        }
        return indicatorBox(api, s, visible, activeProvider, quotaResult);
      }
    }
  });
  api.renderer.requestRender();
};
function indicatorLines(s, provider, quotaAccessor) {
  const lines = [];
  if (provider?.id === "zai") {
    const current = zaiRate(s);
    lines.push(current.detail ? `${current.label} ${current.detail}` : current.label);
  } else if (provider) {
    const q = quotaAccessor?.();
    lines.push(q?.label ?? provider.id.toUpperCase());
  } else {
    lines.push("No quota provider");
  }
  if (quotaAccessor) {
    const q = quotaAccessor();
    if (q) {
      const line = quotaLine(q);
      if (line)
        lines.push(line);
    }
  }
  return lines;
}
function indicatorBox(api, s, visible, provider, quotaResult) {
  const isZaiPeak = () => provider()?.id === "zai" && zaiRate(s).peak;
  const box = createElement("box");
  setProp(box, "width", "100%");
  setProp(box, "paddingLeft", 1);
  setProp(box, "paddingRight", 1);
  if (isZaiPeak()) {
    setProp(box, "border", true);
    setProp(box, "borderColor", api.theme.current.error);
  }
  const text = createElement("text");
  setProp(text, "fg", isZaiPeak() ? api.theme.current.error : api.theme.current.success);
  setProp(text, "bold", isZaiPeak());
  insert(text, () => visible() ? indicatorLines(s, provider(), quotaResult).join(`
`) : " ");
  insert(box, text);
  return box;
}
const pluginModule = {
  id: "opencode-zai-rate-indicator",
  tui
};
export default pluginModule;
