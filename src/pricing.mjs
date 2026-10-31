// 费率表与算钱。
// 单位一律：元 / 百万 token。miss = 未命中缓存的输入，hit = 命中缓存的输入，out = 输出。
// 默认值是 DeepSeek Flash 的公开价；别的模型换一张表就行，或者用 makePricer 传时间分段。

export const DEFAULT_RATES = Object.freeze({ miss: 1, hit: 0.02, out: 4 })

/**
 * 造一个「按时间查费率」的函数，用来处理平台临时调价。
 * rules: [{ from: ISO 时间, rates: { miss?, hit?, out? } }]，from 之后生效，后写的覆盖前写的。
 */
export function makePricer(rules = [], fallback = DEFAULT_RATES) {
  const sorted = rules
    .map((r) => ({ from: Date.parse(r.from), rates: { ...fallback, ...r.rates } }))
    .filter((r) => Number.isFinite(r.from))
    .sort((a, b) => a.from - b.from)

  return function priceAt(ts) {
    let rates = fallback
    for (const r of sorted) {
      if (!Number.isFinite(ts)) break
      if (ts >= r.from) rates = r.rates
    }
    return rates
  }
}

/** 一条 usage 记多少钱（元）。 */
export function costOf(ts, usage = {}, priceAt = makePricer()) {
  const p = priceAt(ts)
  const miss = Number(usage.inputTokens ?? 0)
  const hit = Number(usage.cacheReadTokens ?? 0)
  const out = Number(usage.outputTokens ?? 0)
  return (miss * p.miss + hit * p.hit + out * p.out) / 1e6
}

/** 缓存命中率（%）：命中输入 /（命中 + 未命中）。没有输入时返回 null。 */
export function cacheHitRate({ inputTokens = 0, cacheReadTokens = 0 } = {}) {
  const denom = inputTokens + cacheReadTokens
  if (!denom) return null
  return (cacheReadTokens / denom) * 100
}
