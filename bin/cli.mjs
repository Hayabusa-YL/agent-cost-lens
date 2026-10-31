#!/usr/bin/env node
// 用法：
//   cost-lens report <session.jsonl>                 → 打印对账单
//   cost-lens report <a.jsonl> --baseline <b.jsonl>  → 跟另一份会话比偏差
//   cost-lens report <a.jsonl> --baseline 12.5       → 直接给基线金额（元）
//   cost-lens report <a.jsonl> --json                → 输出 JSON 而不是 Markdown
//   --prices prices.json                             → 自定义费率：{ "2026-01-01T00:00:00Z": { "miss": 2, "hit": 0.04, "out": 8 } }
import { readFileSync } from 'node:fs'
import { makePricer, DEFAULT_RATES } from '../src/pricing.mjs'
import { loadEvents, aggregate } from '../src/session.mjs'
import { renderReport } from '../src/report.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

function buildPricer(file) {
  if (!file) return { priceAt: makePricer(), note: `默认表 miss ${DEFAULT_RATES.miss} / hit ${DEFAULT_RATES.hit} / out ${DEFAULT_RATES.out} 元每百万` }
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const rules = Object.entries(raw).map(([from, rates]) => ({ from, rates }))
  const lines = rules.map((r) => `${r.from} 起 miss ${r.rates.miss ?? '—'}`).join('，')
  return { priceAt: makePricer(rules), note: lines || '空费率表，用默认值' }
}

function main() {
  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log('cost-lens report <session.jsonl> [--baseline <file|元>] [--prices <json>] [--json]')
    return 0
  }
  if (cmd !== 'report') {
    console.error(`不认识的命令：${cmd}`)
    return 2
  }

  const file = argv[1]
  if (!file) {
    console.error('缺会话文件：cost-lens report <session.jsonl>')
    return 2
  }

  const { priceAt, note } = buildPricer(flag('--prices'))
  const agg = aggregate(loadEvents(file), priceAt)

  const rawBase = flag('--baseline')
  let baseline = null
  if (rawBase !== undefined) {
    baseline = Number.isFinite(Number(rawBase)) ? Number(rawBase) : aggregate(loadEvents(rawBase), priceAt).cost
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...agg, baseline }, null, 2))
    return 0
  }

  console.log(renderReport(agg, { title: `成本对账 ${file}`, baseline, priceNote: note }))
  return 0
}

process.exit(main())
