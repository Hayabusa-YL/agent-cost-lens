# agent-cost-lens

把 Agent 会话流水算成钱：一条命令给出总花费、缓存命中率、每次调用均价，以及跟基线比超没超两成。

面向的场景很窄：**在本地跑 Agent 的人**。云端那批可观测性工具默认你在服务端用 SDK 或代理调 API，看不见桌面端一次会话里混着多少工具调用、多少缓存命中、钱花在哪一轮。

## 它算什么

输入是一份 JSONL 会话流水，每行一条事件，形状只要满足：

```json
{"time": 1767225600000, "data": {"usage": {"inputTokens": 48213, "cacheReadTokens": 1902331, "outputTokens": 3311}}}
```

也认 `prompt_tokens` / `completion_tokens` / `cache_read_input_tokens` 这些别名，行内没有 usage 或没有时间戳的会被跳过。

输出：总花费、事件数、每事件均价、缓存命中率、按天明细、跟基线的偏差。

## 用法

```bash
node bin/cli.mjs report demo/sample-session.jsonl
node bin/cli.mjs report today.jsonl --baseline 12.5        # 基线直接给金额
node bin/cli.mjs report today.jsonl --baseline yesterday.jsonl  # 或者拿另一份会话当基线
node bin/cli.mjs report today.jsonl --json                 # 给下游用
```

demo 跑出来长这样：

```
- 总花费：0.23 元
- 事件（调用）数：6
- 每个事件均价：0.0378 元
- 缓存命中率：97.7%
- token：未命中输入 101502　命中输入 4392181　输出 9362
- 基线：1.20 元　偏差 -81%
```

## 费率

默认表是 DeepSeek Flash 的公开价，单位元/百万 token：未命中输入 1、命中输入 0.02、输出 4。

平台会在某些时段临时调价（实测过上午三小时翻倍），所以支持时间分段：

```json
{
  "2026-01-01T00:00:00Z": { "miss": 1, "hit": 0.02, "out": 4 },
  "2026-01-02T00:00:00Z": { "miss": 2, "hit": 0.04, "out": 8 }
}
```

```bash
node bin/cli.mjs report today.jsonl --prices prices.json
```

**费率必须自己对一遍**。算出来的钱只在费率表对得上时才有意义，这一点没有捷径：拿平台账单跟本地算的比一天，误差 5% 以内再信它。

## 判读口径

- 超基线两成 → 先看缓存命中率掉没掉，再看每次调用的事件数涨没涨。
- 明显低于基线 → 通常不是省钱，是费率表过期了。
- 命中率突然从 95% 掉到 60%，说明上下文被重排过，钱会翻好几倍。

## 自检

```bash
npm test
```

六个用例：单位换算、命中价差 50 倍、时间分段生效、命中率分母、按天分组求和、对账单结论分支。

## 边界

- 只认 usage 形状的流水，不管日志收集、传输、存储。
- 只算钱，不评估「这次调用值不值」。
- 没有 Web UI，输出是 Markdown 和 JSON。
- 单个会话几百到几千条事件的量级；更大的量请自己分片。

MIT
