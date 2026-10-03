# memory-loop

闭合 ZCode 的**记忆回路** —— 把钩子收集的「记忆候选」变成会话开始时真的会被读到的长期记忆。

## 它补的是哪个缺口

ZCode 的记忆链路上缺了**消费者**：

```
stop-memory.js 钩子 ──写出──▶ memory-candidates.jsonl ──✗ 没有任何东西读它
   （生产者，每轮跑）              （256 KB / 276 条，只增不减）
```

上游那个钩子只做**机械**判断：命中「文件改动 / 决策」信号，就把回复的前 400 字追加进 jsonl。
于是文件里是**原始回复片段**，不是记忆 —— 而且 ZCode 原生根本不读它。

本插件补上后半段：

| 阶段 | 谁做 | 做什么 |
|---|---|---|
| ① 分流 | `Stop` 钩子（自动） | 按候选里的 `cwd` 找到所属项目 → 写进各仓库的 `.zcode/memory/candidates.jsonl`，按内容指纹去重 |
| ② 蒸馏 | `/memory-loop` 命令（手动） | 模型读候选 → 判断哪些值得长期保留 → 整理进 `MEMORY.md` |
| ③ 注入 | `SessionStart` 钩子（自动） | 把 `MEMORY.md` 注入上下文 —— **这是唯一让记忆真正生效的一步** |

② 之所以是手动的：脚本没法判断「这条值不值得记」。把语义判断写死成启发式，只会产出噪音。

## 安装

在市场里 Install `memory-loop` → **开新会话**（hook 配置是启动时快照）。

默认对接上游 `~/.zcode/hooks/memory-candidates.jsonl`。那个文件不存在，本插件也不会报错，
只是什么都不做 —— 装错了不会坏事。

## 命令

| 命令 | 作用 |
|---|---|
| `/memory-loop` | 读候选 → 蒸馏 → 写 `MEMORY.md` → 推进蒸馏游标 |
| `/memory-loop status` | 只看候选数 / 现有记忆 / 蒸馏进度，不改文件 |

## 数据落点

全部在**项目内**，可以 review、可以进 git：

```
<repo>/.zcode/memory/
├── candidates.jsonl   ① 的输出：本项目相关的候选（去重后）
├── MEMORY.md          ② 的输出：蒸馏后的长期记忆（SessionStart 注入这个）
└── state.json         蒸馏游标 {"distilled": N} —— SessionStart 用它决定要不要提示
```

唯一的例外是**消费游标** `ingest-state.json`，放在插件数据目录
（`~/.zcode/cli/plugins/data/memory-loop@zcode-plugin/`）。
放那里的理由：它是纯粹的机械进度，一旦丢失只需重扫一遍源文件 ——
项目侧的内容指纹去重会兜住，不会产生重复条目。**重装插件会清空它，这是设计允许的。**

## 配置

用环境变量覆盖（不需要项目级配置）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `MEMORY_LOOP_SOURCE` | `~/.zcode/hooks/memory-candidates.jsonl` | 候选源文件 |
| `MEMORY_LOOP_MAX_CHARS` | `4000` | SessionStart 单次注入上限，超出则截断并注明原文位置 |

## 怎么验证它在工作

```bash
# 1. 分流有没有发生（跑过至少一轮会话后）
ls <repo>/.zcode/memory/candidates.jsonl

# 2. 消费游标
cat ~/.zcode/cli/plugins/data/memory-loop@zcode-plugin/ingest-state.json

# 3. 注入有没有发生：开新会话，顶部应出现 [memory-loop] 前缀的一段
```

## 设计决策（为什么这么做）

- **注入用 `SessionStart`，不用 `UserPromptSubmit`。** 后者每轮都跑，
  把同一份记忆重复注入 N 次，纯粹烧上下文预算。
- **`Stop` 钩子不注入任何上下文。** 它是纯副作用。在 `Stop` 上注入文本会干扰
  模型对当轮回复的收尾（同事件的其他钩子已经在做这件事了）。
- **同步执行而不是 `async: true`。** 状态必须落盘完成才返回；实测总耗时约 85 ms，
  远低于 `timeoutMs`，不值得为它引入后台进程的复杂度。
- **路径从 payload 的 `cwd` 现算。** 插件是全局生效的，写死路径必错。
- **`cwd` 落在 home 时一律跳过。** 否则「项目专属」会变成「全局」，那是不可逆的污染。
- **去重指纹只用 `signals + summary 前 200 字`。**
  `ts` 和 `session_id` 每次不同，但它们不区分内容 —— 放进指纹就永远去不了重。

## 已知限制（未验证项，别当结论）

- **装好后没有在真实会话里跑过。** 全部行为来自对钩子脚本的直接调用测试（35 项断言全过），
  但「ZCode 真的会在每轮 Stop 时调用它」这一步还没有实测证据。
- 上游 `stop-memory.js` 与本插件**没有耦合**：上游改了文件名或格式，本插件会静默失效
  （读不到就当空）。这是刻意的 fail-open，但意味着**上游变更需要手动同步**。
- 候选质量取决于上游的启发式 —— 上游那条「有改动信号 + 有路径」的判定比较宽松，
  所以 `candidates.jsonl` 里会有不少本该丢掉的条目。蒸馏那一步要真的做筛选，别照搬。
