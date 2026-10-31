import test from 'node:test'
import assert from 'node:assert/strict'
import { costOf, cacheHitRate, makePricer, DEFAULT_RATES } from '../src/pricing.mjs'
import { aggregate } from '../src/session.mjs'
import { renderReport } from '../src/report.mjs'

test('默认费率：一百万未命中输入 = 1 元', () => {
  const c = costOf(Date.now(), { inputTokens: 1_000_000 })
  assert.equal(Math.round(c * 100) / 100, DEFAULT_RATES.miss)
})

test('默认费率：一百万命中输入是未命中的五十分之一', () => {
  const hit = costOf(Date.now(), { cacheReadTokens: 1_000_000 })
  const miss = costOf(Date.now(), { inputTokens: 1_000_000 })
  assert.equal(Math.round((miss / hit) * 100) / 100, 50)
})

test('时间分段：from 之后用新费率，之前用旧费率', () => {
  const priceAt = makePricer([{ from: '2026-01-02T00:00:00Z', rates: { out: 8 } }])
  const before = costOf(Date.parse('2026-01-01T12:00:00Z'), { outputTokens: 1_000_000 }, priceAt)
  const after = costOf(Date.parse('2026-01-02T12:00:00Z'), { outputTokens: 1_000_000 }, priceAt)
  assert.equal(before, 4)
  assert.equal(after, 8)
})

test('缓存命中率按命中/(命中+未命中)算，没有输入时为 null', () => {
  assert.equal(cacheHitRate({ inputTokens: 1, cacheReadTokens: 9 }), 90)
  assert.equal(cacheHitRate({}), null)
})

test('汇总：两条事件的钱加起来，按天分组', () => {
  const priceAt = makePricer()
  const t = Date.parse('2026-03-01T10:00:00Z')
  const agg = aggregate(
    [
      { time: t, usage: { inputTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 } },
      { time: t + 3600_000, usage: { inputTokens: 0, cacheReadTokens: 50_000_000, outputTokens: 0 } },
    ],
    priceAt,
  )
  assert.equal(agg.events, 2)
  assert.equal(Math.round(agg.cost * 100) / 100, 2) // 1 元 + 50M 命中 * 0.02/M = 1 元
  assert.equal(agg.days.length, 1)
  assert.equal(agg.days[0].date, '2026-03-01')
})

test('对账单：超基线两成时给出对应结论', () => {
  const agg = { cost: 12, events: 10, perEvent: 1.2, cacheRate: 90, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, days: [] }
  assert.match(renderReport(agg, { baseline: 9 }), /超基线两成/)
  assert.match(renderReport(agg, { baseline: 12 }), /正常范围/)
  assert.match(renderReport(agg, {}), /没有基线/)
})
