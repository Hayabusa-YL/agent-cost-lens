// 汇总 → Markdown 对账单。带一个「跟基线比超没超两成」的判断，够用就行，不搞仪表盘。

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—')

/** 基线可以是总花费（元），也可以是另一份 aggregate 结果。 */
export function renderReport(agg, opts = {}) {
  const { title = '成本对账', baseline = null, threshold = 0.2, priceNote = '' } = opts
  const base = typeof baseline === 'number' ? baseline : baseline?.cost ?? null
  const dev = base && base > 0 ? agg.cost / base - 1 : null

  let verdict
  if (dev === null) verdict = '没有基线，只记数不判偏差'
  else if (dev > threshold) verdict = '超基线两成：先查缓存命中，再查每轮事件数'
  else if (dev < -threshold) verdict = '明显低于基线：检查费率表是不是过期了'
  else verdict = '在正常范围（±20%）内'

  const lines = [
    `# ${title}`,
    '',
    `- 总花费：${fmt(agg.cost)} 元`,
    `- 事件（调用）数：${agg.events}`,
    `- 每个事件均价：${fmt(agg.perEvent, 4)} 元`,
    `- 缓存命中率：${agg.cacheRate === null ? '—' : fmt(agg.cacheRate, 1) + '%'}`,
    `- token：未命中输入 ${agg.inputTokens}　命中输入 ${agg.cacheReadTokens}　输出 ${agg.outputTokens}`,
  ]
  if (priceNote) lines.push(`- 费率：${priceNote}`)
  if (base !== null) lines.push(`- 基线：${fmt(base)} 元　偏差 ${dev === null ? '—' : (dev > 0 ? '+' : '') + fmt(dev * 100, 0) + '%'}`)

  lines.push('', '## 按天', '')
  lines.push('| 日期 | 花费 | 事件 | 缓存命中 |')
  lines.push('| --- | --- | --- | --- |')
  for (const d of agg.days) {
    const rate = d.inputTokens + d.cacheReadTokens ? (d.cacheReadTokens / (d.inputTokens + d.cacheReadTokens)) * 100 : null
    lines.push(`| ${d.date} | ${fmt(d.cost)} 元 | ${d.events} | ${rate === null ? '—' : fmt(rate, 1) + '%'} |`)
  }

  lines.push('', '## 结论', '', verdict, '')
  return lines.join('\n')
}
