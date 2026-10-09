# 实施单：doc-protocol 体量治理 + 会话开场注入（合并版）

- 日期：2026-10-05
- 目标仓库：`D:\Code\zcode-plugin`（本仓库）；落地目标：`D:\Code\stock-agent`
- 本单**合并自**（原两份规划已降为历史，见各文件顶部墓碑）：
  - `docs/plans/doc-protocol-bloat-control-optimized-2026-10-05.md` —— 体量治理 R1'~R8'（外部最佳实践对照）
  - `docs/plans/project-guardrails-entrypoints-task-2026-10-04.md` —— `project-guardrails` 的 `entrypoints` 任务单
- 前置依据：
  - `docs/reviews/doc-protocol-handoff-bloat-review-2026-10-05.md`（体量审查：账本无出口 / 指令文件触顶 / 三个阈值越线未执行）
  - `docs/reviews/doc-protocol-design-review-2026-10-04.md`（接入层未达成：技能按需调用、开场不加载）
- 状态：
  - **Part A（协议改动）—— ✅ 已落盘**（`skills/doc-protocol/SKILL.md` + `references/*`，本次）
  - **Part B（体量闸脚本）—— ✅ 已写**（`skills/doc-protocol/assets/check-doc-budget.py`，随技能分发；**不复制进目标仓库**，2026-10-05 更正）
  - **Part C（插件 entrypoints）—— ⬜ 待实施**（本文档的规格部分）
  - 本文件本身**未改动任何插件代码**。

---

## 0. 一句话与合流图

**把「每会话必读」的载体从「必然膨胀」变成「有上限、会自动报警」。**

两个问题——**载体膨胀**（Part A）与**开场读不到待办**（Part C）——由**同一个数据源**串起来：

```
                 Part A：协议给载体定预算 + 定「投影」出口
                 （SKILL.md 第一/三/四/五/七/八节）
                              │
                              ▼
                 Part B：check-doc-budget.py  ← 把预算变成「闸」
                  输出 JSON（体积/死行/越线/补记）
                       │                    │
        消费点 ① 收尾第 0 步        消费点 ② Part C：SessionStart 注入
        （退出码非零即红）           （开场把「账本 N KB / 交接 N 行 / 已越线」打进上下文）
```

**Part B 与 Part C 必须合流**：同一个预算数据，一处用来「收尾时拦」，一处用来「开场时预警」。
分开做两份，必然漂移 —— **合流的落点是「同一份阈值配置」（`doc-budget.json`），
不是「两份实现各抄一遍常量」**（2026-10-05 质检更正，见 §4.4）。

---

## 1. 为什么这两个问题该一起解

| | 体量问题（Part A/B） | 接入问题（Part C） |
|---|---|---|
| 症状 | 账本 60% 死行、指令文件 91.5% 触顶、阈值越线未执行 | 开场只说「继续」时，agent 不知道欠着什么 |
| 根因 | **热层载体无预算、无出口、无闸** | **技能按需调用、开场不加载**（源码文案：`The following skills are available for use with the Skill tool:`） |
| 通路 | 收尾清单（生命周期事件） | `SessionStart` hook（确定性注入，不过准入闸） |
| 交汇 | **check-doc-budget.py 的输出** | **同左** |

⇒ 只修体量：开场仍读不到；只修接入：注入的是一个正在膨胀、即将不可读的账本。
**两件一起做，才是「热层既读得到、又读得动」。**

---

## 2. Part A —— doc-protocol 协议改动（✅ 已落盘）

落点：`skills/doc-protocol/SKILL.md`（217 → 285 行）+ `references/stock-agent.md` + `references/evidence.md`。

| # | 改动 | 落点（节） | 关键判据 / 现状数字 |
|---|---|---|---|
| **A1** | **账本 = 「未完成投影」不变量**：活表**只放未完成项**，任何 `~~` 行必须同一收尾动作内 ①追加冷层 `docs/archive/<name>-ledger-<YYYY-MM>.md`（append-only）②从活表删除 | §四 | 判据 `grep -c '~~' 活表 == 0`；实测账本 42 行里 **25 行（60%）是死行** ⇒ 直接砍掉 |
| **A2** | 账本**双预算**：≤ 15 KB 且 ≤ 40 行；活跃条数 ≤ 30（软） | §四 | 现状 **91,355 B / 42 行** ⇒ 超 6× |
| **A3** | 账本**单行软上限**：≤ 600 B，「下一步/备注」列 ≤ 200 字 | §四 | 最长单行 **5,249 B** |
| **A4** | **指令文件双预算**：≤ 60 KB 且 ≤ 150 条 standing instruction；超限**抽叙事成独立文件**、指令文件留一行指针 | §三 | 现状 **93,700 B = 100 KB 读取预算的 91.5%**，超限**静默截断尾部** |
| **A5** | 归档线补**字节判据**：2000 行 **或** 500 KB（先到者）；归档单片 ≤ 500 KB（超即开新片） | §五 | 现状 2044 行 / **648,626 B**；v1 归档片 476 KB |
| **A6** | **补记 ≤3 机械化**：`补记{N}` 写入时自查 + 段头格式校验 | §五 | 实测 **≥17 处越限、最多 10 条** |
| **A7** | 第一节分类学**加「层」列**（热/温/冷）+ 三层定义与预算 | §一 | 热层 = 唯一需要预算的层 |
| **A8** | 收尾清单加**第 0 步「体量闸」** + **第 7 步「陈旧即删」**；账本对账改为「投影」 | §七 | 阈值出口从「人记」变「脚本拦」 |
| **A9** | 红灯新增 8（活账本出现 `~~`）、9（陈旧内容滞留） | §八 | — |
| **A10** | 实证追加 **E12/E13/E14**（热层无出口 / 指令文件静默触顶 / 阈值全靠自律） | `references/evidence.md` | — |

> **只压缩「叙事与死行」，绝不压缩「规则」**（§4 张力裁定：规则/决策整块留热层，叙事/过程下沉冷层）。

---

## 3. Part B —— `check-doc-budget.py`（✅ 已写）

落点（**唯一真源**）：`skills/doc-protocol/assets/check-doc-budget.py`，随技能分发到技能安装态。
**不在目标仓库放副本**（2026-10-05 更正 —— 原写「复制到 `scripts/`」是错的，见 SKILL.md 9.1 第 3 条）。

**用法**（以技能安装态路径调用，`--root` 指向仓库）

```bash
python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root .
python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root D:/Code/stock-agent
python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root . --config doc-budget.json   # 该文件须已存在，否则 exit 2
python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --quiet   # 只输出 JSON
```

> **为什么不复制**：脚本的 `DEFAULTS` 已由 `--root` / `--config` 完全参数化 ⇒ stock-agent
> **零配置即用**；复制一份只有「分叉」的坏处（技能一改，仓库副本陈旧）。
> 唯一例外：目标仓库有 **CI / pre-commit** 等独立于技能安装的消费方时，才在仓库建**实例**，
> 并在文件头注明「派生自 `doc-protocol/assets/check-doc-budget.py`@<版本或日期>」。

**退出码**：`0` 在预算内（可能带 warning）· `1` 存在**硬越线** · `2` 用法/配置错误。

**输出（JSON，节选）**

```json
{ "ok": false,
  "violations": [ {"code":"ledger.completed_rows","actual":25,"limit":0,
                   "message":"活账本含 25 行 `~~` 已完成行 —— 违反「未完成投影」不变量…"} ],
  "warnings":   [ {"code":"ledger.row_bytes","actual":5249,"limit":600,"message":"…"} ],
  "report": { "documents": {...}, "ledger": {...}, "addenda": {...},
              "archive": {...}, "segmentHeader": {...} } }
```

**检查项（硬 / 软分开）**

| 检查 | 类别 | 默认阈值 |
|---|---|---|
| `handoff.md` 行数 / 字节 | 硬 | 2000 行 / 500 KB |
| `AGENTS.md` 字节 / 条数 | 硬 | 60 KB / 150 条 |
| 活账本字节 / 行数 / **含 `~~` 行** | 硬 | 15 KB / 40 行 / **0** |
| 活账本条数 / 单行字节 | 软 | 30 条 / 600 B |
| 段内补记 | 硬 | ≤3 / 段 |
| 归档单片字节 | 硬 | 500 KB |
| 段头格式 | 软 | `## YYYY-MM-DD(第N段)…` |

**实测（对 stock-agent，只读）**：复现审查全部数字 —— `handoff` 2044 行/648,626 B、
账本 91,355 B/42 行/25 死行/最长行 5,249 B、`AGENTS` 93,700 B/135 条；退出码 **1**。
边界：空目录 → exit **0**；缺失路径 → exit **0**；`py_compile` 通过。

**两个消费点**：
1. **收尾清单第 0 步** —— 退出码非零即红（Part A8）。
2. **Part C 的 SessionStart 注入** —— 见下。

---

## 4. Part C —— `project-guardrails` 的 `entrypoints`（✅ 已实施 2026-10-05）

> **2026-10-05 二次修订（v1.1.0 → v1.1.1）**：头头质疑「为什么要手动添加 `.agents/guardrails.json`，
> 很不符合开箱即用」⇒ 补**内置约定集**（约定优于配置）。
> 本节的 `entrypoints[]` 从「必须配置」改为「**可选覆盖**」：
> 不写配置时，只要仓库里有账本载体（默认 `handoff.md`）就自动注入；
> `"entrypoints": []` 才是明确关掉。同时修掉两处被这个耦合掩盖的缺陷 ——
> **`doc-budget.json` 单独放置无效**、**`from: null` 在表格块与账本块语义不一致**。
> 测试 30 → 37 条。详情见 `HANDOFF.md` §15。

目标插件：`plugins/project-guardrails`（v1.0.0 → **v1.1.0**，实装为 **v1.1.1**）。
补的是：技能按需调用、开场不加载 ⇒ **用用户级插件的 `SessionStart` hook 把仓库待办账本 + 体量状态确定性注入**。

**为什么放进现有插件而不新建第 4 个**：该插件已有 `SessionStart` 钩子、已有项目级声明文件、已有 `resolveProject()`。
加一个 `entrypoints` 数组即得，活动部件不增加。

### 4.0 配置落点：**双路径**（头头已拍板）

`.zcode/` 在目标仓库被 `.gitignore` 吃掉（实测 `git check-ignore -v .zcode/guardrails.json`
→ `.gitignore:6:.zcode/*`），配置**不入库**、换机器即丢 ⇒ 与「跨会话/跨 agent 接续」直接冲突。

```js
// hooks/lib/guard.mjs
export const RULES_RELS = [".agents/guardrails.json", ".zcode/guardrails.json"];  // .agents/ 优先
```

- 取**第一个存在且可解析**的；`.agents/` 实测**未被忽略**（可入库），`.zcode/` 保留回退（零破坏）。
- ⚠️ 连带：`hooks/lib/project.mjs:28` 的 `findProjectRoot` 标记集加 `.agents`。
- ⚠️ 路径逻辑只留一处：抽 `readGuardrailsFile(root)`，`loadGuardrails()` 与 `loadEntrypoints()` 共用。
- 同步 8 处只提 `.zcode/` 的文案：`session-rules.mjs:1`、`pretooluse-guard.mjs:1`、`hooks.json:2`、
  `README.md:30/39/43`、`commands/guardrails.md:6/46/51/73`、`lib/guard.mjs:3`。

### 4.1 ZCode 契约（源码实测，实施时照抄）

**hook 输出顶层 schema**（源码 `uyr`）——未知键被 zod **剥掉**，写错等于没写：
`additionalContext?` / `additional_context?` / `continue?` / `decision?("approve"|"block")` /
`hookSpecificOutput?` / `reason?` / `stopReason?` / `suppressOutput?` / `systemMessage?`

`hookSpecificOutput` = `discriminatedUnion("hookEventName", …)`，7 分支字段不同：

| hookEventName | 允许字段 |
|---|---|
| `PreToolUse` | `additionalContext?` `permissionDecision?("allow"/"ask"/"deny")` `permissionDecisionReason?` `updatedInput?` |
| `UserPromptSubmit` / **`SessionStart`** / `PostToolUse` / `PostToolUseFailure` / `Stop` | `additionalContext?` |
| `PermissionRequest` | `decision?` —— **没有 `additionalContext`** |

- **`SessionStart` / `Stop` 的 `additionalContext` 是 push 累积**（源码
  `case Tl.SessionStart: case Tl.Stop: t.additionalContext && e.additionalContexts.push(t.additionalContext)`）
  ⇒ 与 `session-rules.mjs` **互不覆盖**，无需合并。
- 复用 `hooks/lib/io.mjs` 的 `emitContext(eventName, text)` / `emitPass()`，**不要另写**。

**插件 hooks.json 条目**（源码 `vrs`）：`process` 型 = `command/args/timeoutMs/enabled/statusMessage`；
`command` 型才吃 `async/shell`。现有条目用 `process` + `${ZCODE_PLUGIN_ROOT}`，照旧。

**hook 输入 payload**：源码确认 `hook_event_name` / `session_id` / `permission_mode` / `agent_type` /
`transcript_path`；`cwd` 由现有钩子实证可用。

> 🔴 **`source`（`startup|resume|clear|compact`）字段名未定位到** ⇒ **先做 §4.6 P1 探测，再写逻辑**，不许猜。

### 4.2 schema（`guardrails.json` 新增 `entrypoints`）

```json
{
  "version": 1,
  "entrypoints": [
    { "id": "handoff-ledger", "label": "handoff 待办账本", "file": "handoff.md",
      "kind": "markdown-table", "from": "## 剩余未完成与遗留事项",
      "statuses": ["🔴","🟡","⏳"], "maxRows": 20, "maxChars": 1800 },
    { "id": "budget", "label": "体量状态", "kind": "budget",
      "config": "doc-budget.json" }
  ]
}
```

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `id` / `label` | 否 | `file` / `id` | 诊断用 / 注入块标题 |
| `file` | 是（table 类） | — | 相对**仓库根**；**必须拒绝绝对路径与含 `..`** |
| `kind` | 否 | `markdown-table` | v1：`markdown-table` \| `budget` |
| `from` / `to` | 否 | — / 下一个同级标题 | 前缀匹配；找不到 → 文件头 |
| `statuses` | 否 | `["🔴","🟡","⏳"]` | 只保留这些状态行 |
| `maxRows` / `maxChars` | 否 | `20` / `1800`（硬上限 4000） | — |
| `config`（budget） | 否 | `doc-budget.json` | 阈值**与**参与摘要的文件列表的来源（相对**仓库根**）；**与 Python 脚本 `--config` 同一个文件** ⇒ 阈值单一真源（见 §4.4）。缺文件 → 回退 `entrypoints.mjs` 内的 `DEFAULTS` 快照（值须与脚本 `DEFAULTS` 相等，有断言测试） |

规范化：**任何字段非法 → 丢弃该条 entry，不抛错**；`entrypoints` 不存在 → 行为与 v1.0.0 完全一致。

### 4.3 解析规格（`kind: "markdown-table"`，逐条可测）

输入 `<repo>/<file>` 全文（`readFileSync`）。**硬约束：只读，绝不写回 `handoff.md`。**

1. 文件不存在 / 读失败 → 跳过该 entry，**无任何输出**（fail-open）。
2. **切区间**：首个以 `from` **开头**的行起，到下一个标题行（`/^#{1,6}\s/`）止；`from` 缺失 → 从第 0 行。
3. 表格行 = `/^\s*\|.*\|\s*$/`；**跳过表头分隔行** `/^\s*\|[\s:|-]+\|\s*$/`。
4. 取单元格：`split("|")`，去首末空串，其余 `trim()`。
5. **完成判定**：第 1 格含成对 `~~` → 丢弃（**该约定真在用**：实测全文 `~~` 292 处）。
6. **状态判定**：第 1、2 格中查 `🔴/🟡/⏳/✅/❌`，取最先出现者；命中 `statuses` → 留，否则丢；
   **一个都没命中 → 丢，但计数**。
7. **标题提取**：第 1 格剥掉 `~~`、`**`、首尾 emoji 与空白，压缩空白，截到 **80 字**。
8. **⏳ 到期判定**：第 1 格 `(\d{2})-(\d{2})` 抓 `MM-DD` 补**本年度**，早于今天 → `⏳过期 N 天`。
   ⚠️ 年份是**推断** ⇒ 注入块末句必须声明（见 §4.4）。
9. **排序**：`🔴` → `⏳过期` → `🟡` → `⏳`；同级保原文序。
10. **截断**：先 `maxRows` 再 `maxChars`（**整行丢弃**）；发生丢弃时追加汇总行。

### 4.4 注入文本格式（逐字规格）

```
[entrypoints] 体量：handoff 2044 行/648 KB(超) · 活账本 91 KB(超 6×, 25 死行) · AGENTS 92 KB/135 条(超)
[entrypoints] handoff 待办账本（handoff.md:7-66）待办 17 项：
- [🔴] 38号 FactorLab 重设计处置核查（09-28 用户令「检查是否修改正确」）
- [⏳过期 9 天] D1 验证点（09-25）
- [🟡] 39号 P3 第二批（判据进图余五处）
...
（共 42 行，已显示 20 行；另有 4 行无状态符号未列出）
读取正文用 Read 工具。本块是索引，不是真值；年份为推断，以正文为准。
```

> 上面数字只是**格式示形**（会随仓库变化）；真值以脚本 / hook 的实际输出为准，**勿引用此处的数字**。

| 规则 | 理由 |
|---|---|
| 每行 `- [状态] 标题`，状态**原样** emoji | 与 `handoff.md` 状态词表一致，人眼可对 |
| 首行必带 `（<file>:<起>-<止> 行）` | agent 可直接 `Read offset/limit`，不必先 grep |
| **末句必须存在**：「本块是索引，不是真值；年份为推断，以正文为准。」 | doc-protocol 核心法是「单一权威载体」。本块是**指针**不是副本 |
| **`budget` 行**（Part B 输出摘要）必需 | 让回弹**在越线前可见**；这是 Part B/C 合流的落点 |
| 汇总行只在**发生截断**时输出 | 无截断别加噪音 |
| 无 `entrypoints` / 无可列行 → **不发输出**（`emitPass()`） | 空块白吃 token，且让「没配」像「配坏了」 |

**长度预算**：单条 ≤ `maxChars`（默认 1800，硬上限 4000）；多 entry **总** ≤ 6000
（超出按顺序丢弃靠后 entry 并注明）。SessionStart 注入每会话吃一次，必须有天花板。

> **`budget` 行的实现选择**：在 hook（Node）里**直接算**（读文件大小 + 复用账本解析），
> **不要 shell 出去跑 Python**（多一个进程/依赖，且 SessionStart 每会话一次）。
> Python 脚本留给**收尾第 0 步**。
>
> 🔴 **阈值必须单一真源**（2026-10-05 质检更正 —— 原写「两处用同一套阈值常量，在
> `entrypoints.mjs` 里与脚本注释互指」，那一版与本节开头 §0「分开做两份，必然漂移」**自相矛盾**，
> 且「注释互指」是最弱的防漂移手段：无机械校验，改了一处不会报错）：
>
> | 情形 | 唯一真源 | 校验 |
> |---|---|---|
> | 仓库有 `doc-budget.json` | **该文件** —— Python 读它（`--config`）、hook 也读它（`config` 字段） | 有配置即两处同源，无漂移可能 |
> | 仓库无该文件 | 两侧各自的 `DEFAULTS` 快照（Node 侧无法调 Python，快照不可避免） | **断言测试**：hook 与脚本对同一仓库输出的共同子集数值必须相等（见 §4.6 A14） |
>
> ⇒ §4.2 的 `budget` entry **不再重复阈值**，它是「消费哪份配置」的开关，不是第二份常量表。
> 这与 §4.7「把 `SKILL.md` 复制进插件 = 两份必漂移」同一原则。

### 4.5 实施步骤（按序）

0. **双路径改造**（§4.0，**先做**）：`RULES_RELS`、`readGuardrailsFile()`、`project.mjs` 标记集、8 处文案。
1. 新增 `hooks/lib/entrypoints.mjs`：`loadEntrypoints(root)` / `buildEntrypointBlocks(root, specs)`（纯函数，便于直测）。
   **路径安全**必须有实现 + 测试：`resolve(root,file)` 须 `startsWith(resolve(root)+sep)` 且 `file` 非绝对路径。
   另加 `loadBudgetConfig(root, spec)`：读 `spec.config`（默认 `doc-budget.json`），
   **缺文件 / 字段非法 → 回退本文件内的 `DEFAULTS` 快照**（值须与 `check-doc-budget.py:44` 的 `DEFAULTS` 相等 —— 由 A14 断言）。
2. 新增 `hooks/session-entrypoints.mjs`（约 20 行，独立失败域；`session-rules.mjs` 零回归）：
   读 payload → 非 SessionStart 则 `emitPass()` → `resolveProject(cwd)` → `isHome` 则 pass →
   `try { loadEntrypoints → buildEntrypointBlocks → emitContext } catch { emitPass() }`（**fail-open**）。
3. `hooks/hooks.json` 追加**第二个** SessionStart 条目（`process` + `${ZCODE_PLUGIN_ROOT}/hooks/session-entrypoints.mjs`，
   `timeoutMs: 5000`）；同时把顶部 `description` 补 entrypoints 一句、`.zcode/` 改**双路径**表述。
4. 三处 version → `1.1.0`：`.zcode-plugin/plugin.json`、根 `marketplace.json`；description 同步。
5. 文档：`plugins/project-guardrails/README.md` 加 `entrypoints` 一节（schema + 示例 + 「索引非副本」理由 + 双路径 + `git check-ignore` 自检）；
   `commands/guardrails.md` 分派加 `entrypoints`；根 `README.md` 插件表补一行。
6. **更正「工作区 hooks 不执行」措辞**（源码已推翻）：正确表述是「**默认待信任 + hook 摘要一变即失效**」
   （`trustState` 含 `trusted_persistent`）。涉 **10 个文件**，清单见原任务单 §5 步骤 6。
7. **在目标仓库建配置**（**头头手动**，不异动 stock-agent）：`mkdir -p .agents` + 写 `.agents/guardrails.json`
   （含 §4.2 的 `handoff-ledger` 与 `budget` 两条），随后 `git check-ignore -v .agents/guardrails.json` **必须无输出**。
   **可选**：若需覆盖默认阈值，在**仓库根**放 `doc-budget.json`（与脚本 `--config` 同一文件），
   同样跑 `git check-ignore -v doc-budget.json` **必须无输出**（stock-agent 实测已无输出 ✅）。不建则两侧走 DEFAULTS 快照。

### 4.6 验收（可复跑）

**P1（阻塞，必做）** —— 临时在钩子里 dump payload，分别触发 `startup` 与 `/clear`，确认 matcher 字段名与大小写；探完删除。
**P2** —— 实测一次会话 SessionStart 注入总字符数，> 6000 就调小 `maxChars`。

| 组 | 内容 |
|---|---|
| **A 组（直调 11 条）** | A1 含 `[entrypoints]` 且合法 JSON；A2 两次逐字节一致；A3 两落点都无配置 → 空 stdout；A4 file 不存在 → 静默跳过；A5 `../../../etc/passwd` → 拒绝；A6 `maxRows:3` → 恰 3+1；A7 `maxChars:200`；A8 `~~` 行不出现；A9 **用独立脚本**数期望值（不复用被测函数）；A10 原有 35 项直调全绿；A11 所有输出 `JSON.parse` 通过 |
| **A12/A13** | 双路径优先级（`.agents/` 赢）；只用 `.agents/` 的仓库仍能定根 |
| **A14（阈值合流）** | 无 `doc-budget.json` 时：hook budget 摘要的数值 == 脚本对同一仓库输出的**共同子集**（handoff 行/字节、AGENTS 字节、活账本字节/死行）；给了配置时两处读的是**同一文件** |
| **B 组（反向变异，全红才算过）** | B1 `statuses:["🔴"]` → 🟡/⏳ 消失；B2 `from` 不存在 → 行为可预测；B3 无状态行 → 不出现且计数 +1；B4 `maxChars:50` → 汇总行完整、JSON 合法 |
| **C 组（端到端，唯一能证明接入层）** | C1 stock-agent 开新会话只说「继续」；C2 首答即点出账本 🔴 项；**C3 对照：禁用插件再跑 → 应答不出**；C4 `hookCount` 2→3 |

### 4.7 明确不做

| 不做 | 理由 |
|---|---|
| `Stop` 做轮次级「写了文档但账本没动」nudge | 每轮开销 + 「是否写了文档」无法机械判定；二期 |
| 自动修改 `handoff.md` | 只读；账本由人/会话按纪律维护 |
| 把 `SKILL.md` 复制进插件 | 两份必漂移；钩子只注入**索引** |
| 账本路径可配到任意盘符 | 插件全局，只许仓库根内相对路径 |
| 把阈值硬编码进 `entrypoints.mjs` | 两份常量必漂移（同「复制 SKILL.md 进插件」）；阈值只认 `doc-budget.json`，Node 侧仅保留与脚本 `DEFAULTS` 相等的快照 + A14 断言 |
| `entrypoints` 做成独立插件 | 新增活动部件；现有 SessionStart 通道已够 |

### 4.8 未验证（实施者别当已知）

| # | 项 | 影响 |
|---|---|---|
| U1 | SessionStart payload 的触发源字段名 | **阻塞**步骤 2 → 由 P1 解决 |
| U2 | matcher 匹配对象 | 不影响功能（本钩子不依赖 matcher 过滤） |
| U3 | `⏳` 行 `MM-DD` 年份推断 | 跨年误判 → 已在注入块末句免责 |
| U4 | 多 entry 注入块顺序稳定性 | 理论 = 注册顺序，需实测 |
| U5 | 注入块真实 token 开销 | 由 P2 测量 |
| U6 | 主路径下同名技能（用户级 vs 插件）裁决 | 与本任务无关；影响「要不要把技能塞进插件」 |
| U7 | `.agents/guardrails.json` 是否被 Codex 等**其它 agent 工具**误读 | 未验证；`.agents/` 是跨工具根，属**借用** |
| U8 | `findProjectRoot` 加 `.agents` 后的行为变化面 | 只影响「有 `.agents/` 但无 `.git`/`.zcode`」的仓库；A13 覆盖 |

---

## 5. 统一行动清单（按序，标注责任方）

| # | 动作 | 责任方 | 状态 |
|---|---|---|---|
| 1 | 协议改 10 条落进 `SKILL.md` / `references/*` | 小满 | ✅ 本次完成 |
| 2 | 写 `check-doc-budget.py`（技能 `assets/`） | 小满 | ✅ 本次完成 |
| 3 | ~~复制脚本到 `stock-agent/scripts/`~~ **已取消**（改用技能安装态路径，见 §3） | — | ✅ 无需动作 |
| 4 | 把 `skills/doc-protocol/` 同步到 `~/.agents/skills/` | **头头** | ⬜ |
| 5 | Part C 步骤 0~4（双路径 + entrypoints + hooks.json + 版本） | 实施者 | ⬜ |
| 6 | P1 探测（阻塞）→ 实现 → A/B 组验收 | 实施者 | ⬜ |
| 7 | **GUI 刷新市场** → 重装 `project-guardrails` → 开新会话跑 C 组 | **头头** | ⬜ |
| 8 | 目标仓库建 `.agents/guardrails.json`（步骤 7）| **头头** | ⬜ |
| 9 | 文档同步 + 10 处「待信任」措辞更正 | 实施者 | ⬜ |
| 10 | **账本首次投影**（把 25 行死行移入 `docs/archive/handoff-ledger-2026-10.md`）| **头头**（stock-agent 侧）| ⬜ |

---

## 6. 未验证（合并）

- 外部经验值的适用边界：**150~200 条指令**、dumb-zone **40~60%** 来自别的模型/工具，未在本机 ZCode 实测 ⇒ 作参考不作硬判据。
- 「活表只留未完成」对 **grep 引用完整性**的影响：段区若引用账本行，移出后需确认无悬空（实施时核）。
- 冷层单片 **500 KB** 上限：与 v1 现状（476 KB）同量级，未按读取成本实测。
- `budget` 行注入 SessionStart 的 **token 成本**：未测（依赖 Part C 先落地）。
- **hook 侧 budget 与脚本 `DEFAULTS` 的数值一致性**：A14 是**规格**，尚未实测（依赖 Part C 落地）；
  无 `doc-budget.json` 时两侧各持一份常量快照，是目前唯一仍靠测试兜底（而非单一真源）的点。
- **AGENTS.md 超限**：源码确认 `pls=["AGENTS.md"], fls=100*1024`、`_ls()` 做 `Math.min(size,maxBytes)` ⇒ 只读前 100 KB，
  带 `truncated:true`；但**下游（实际进 prompt 的形态与位置）未追**，`truncated` 是否可见也未见。

---

## 7. 参考文献（外部最佳实践，Part A 的依据）

1. Anthropic, *Effective Context Engineering for AI Agents* (2025-09) — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
2. Manus, *Context Engineering for AI Agents*（可恢复压缩、渐进披露）— 中文编译 https://zilliz.com.cn/blog/Context-Engineering-Showdown
3. HumanLayer, *12-Factor Agents* · Factor 3 *Own Your Context Window* — https://paddo.dev/blog/12-factor-agents/
4. AWS China Blog, *Agent 记忆模块的最佳实践*（4-tier + 生命周期四动作）— https://aws.amazon.com/cn/blogs/china/agentic-ai-infrastructure-deep-practice-experience-thinking-series-three-best-practices-for-agent-memory-module
5. Chroma, *Context Rot*；Liu et al., *Lost in the Middle*, arXiv:2307.03172
6. Jon Krohn, *CLAUDE.md, AGENTS.md, Skills, Hooks and Subagents: A Field Guide*（「指令是概率，hook 是保证」）— https://www.jonkrohn.com/posts/2026/8/31/claudemd-agentsmd-skills-hooks-and-subagents-a-field-guide-to-steering-ai-agents

---

## 8. 给决策者的一句话

**协议不缺规则，缺「闸」；接入不缺机制，缺「数据」。**
本单把两者合并：**一份预算数据（Part B），既在收尾时拦（第 0 步），又在开场时预警（Part C 注入）。**
