// 把会话流水（JSONL，一行一条事件）读成按天的账。
// 只要是 { time: <毫秒时间戳>, data: { usage: {...} } } 这种形状就能用；
// usage 里认 inputTokens / cacheReadTokens / outputTokens，也兼容 prompt_tokens 之类别名。

import { readFileSync } from 'node:fs'
import { costOf, cacheHitRate, makePricer } from './pricing.mjs'

function pick(usage, names) {
  for (const n of names) {
    if (usage[n] != null) return Number(usage[n])
  }
  return 0
}

function normalizeUsage(usage = {}) {
  return {
    inputTokens: pick(usage, ['inputTokens', 'prompt_tokens', 'input_tokens']),
    cacheReadTokens: pick(usage, ['cacheReadTokens', 'cache_read_input_tokens', 'cachedTokens', 'cached_tokens']),
    outputTokens: pick(usage, ['outputTokens', 'completion_tokens', 'output_tokens']),
  }
}

/** 读文件 → 事件数组。读不懂的行跳过，不抛错。 */
export function loadEvents(file) {
  const text = readFileSync(file, 'utf8')
  const events = []
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    let row
    try {
      row = JSON.parse(s)
    } catch {
      continue
    }
    const usage = row?.data?.usage ?? row?.usage
    const ts = row?.time ?? row?.ts ?? row?.timestamp
    if (!usage || !Number.isFinite(ts)) continue
    events.push({ time: ts, usage: normalizeUsage(usage) })
  }
  return events
}

const dayKey = (ts) => {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 事件 → 汇总（总量、钱、缓存命中、每事件均价）+ 按天明细。 */
export function aggregate(events, priceAt = makePricer()) {
  const total = { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, cost: 0, events: 0 }
  const days = new Map()

  for (const e of events) {
    const cost = costOf(e.time, e.usage, priceAt)
    const key = dayKey(e.time)
    const day = days.get(key) ?? { date: key, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, cost: 0, events: 0 }
    for (const slot of [total, day]) {
      slot.inputTokens += e.usage.inputTokens
      slot.cacheReadTokens += e.usage.cacheReadTokens
      slot.outputTokens += e.usage.outputTokens
      slot.cost += cost
      slot.events += 1
    }
    days.set(key, day)
  }

  return {
    ...total,
    cacheRate: cacheHitRate(total),
    perEvent: total.events ? total.cost / total.events : 0,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
