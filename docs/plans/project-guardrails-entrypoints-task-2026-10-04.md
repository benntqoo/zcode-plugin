# 任务单：project-guardrails 增加 `entrypoints`（会话开场确定性注入）

> ⚰️ **已退役（2026-10-05）** —— 本文件已并入
> [`doc-protocol-bloat-and-entrypoints-impl-2026-10-05.md`](doc-protocol-bloat-and-entrypoints-impl-2026-10-05.md) 的 **Part C**（含 §4.0 双路径 / §4.1 ZCode 契约 / §4.2 schema / §4.3 解析 / §4.4 注入格式 / §4.5 步骤 / §4.6 验收 / §4.7 不做 / §4.8 未验证）。
> 保留仅作时点证据。**新内容一律进合并版，不再更新本文件。**

- 日期：2026-10-04
- 目标仓库：`D:\Code\zcode-plugin`（本仓库）
- 目标插件：`plugins/project-guardrails`（v1.0.0 → **v1.1.0**）
- 前置依据：`docs/reviews/doc-protocol-design-review-2026-10-04.md` 的 **P0 结论「接入层未达成」**
- 状态：**待实施。本文件未改动任何代码或配置。**
- 修订（2026-10-04 二次核验后）：补 **G1 配置落点双路径**（§2.0，头头已拍板）、**G2 建配置步骤**（§5 步骤 7）、
  **G5 措辞更正扩到 `hooks.json` description**（§5 步骤 3）。原 §1 契约经抽查全部复现，未修正。

---

## 0. 要解决的那个具体问题

doc-protocol 技能是**按需工具调用**（ZCode 源码文案：`The following skills are available for use with
the Skill tool:`），会话开场**不会自动加载**；`AGENTS.md` 是唯一确定性自动注入的通道，但
`stock-agent/AGENTS.md:7` 的三个触发点里**没有 "at session start"**。

⇒ 开场只说「继续」时，agent 不知道欠着什么。

**本任务给出与 AGENTS.md 无关的第二条确定性通道**：用用户级插件的 `SessionStart` hook
读仓库里的待办账本并注入。它不依赖模型自律，也不依赖用户记得改 AGENTS.md。

**为什么放在 `project-guardrails` 而不是新建插件**：该插件已有 `SessionStart` 钩子、已有
`<repo>/.zcode/guardrails.json` 这个项目级声明文件、已有 `resolveProject()`。加一个 `entrypoints`
数组即得，活动部件从 3 个变 3 个（不新增插件）。若日后 `entrypoints` 长成独立语义，再拆。

---

## 1. 已取证的 ZCode 契约（实施时照抄，不要再猜）

### 1.1 hook 输出 schema（源码 `uyr`，逐字）

```js
// 顶层（hook 进程写到 stdout 的 JSON）——未知键会被 zod 剥掉，写错等于没写
{
  additionalContext?: string,
  additional_context?: string,      // snake_case 亦接受
  continue?: boolean,
  decision?: "approve" | "block",
  hookSpecificOutput?: <下面 7 分支之一>,
  reason?: string,
  stopReason?: string,
  suppressOutput?: boolean,
  systemMessage?: string,
}
```

`hookSpecificOutput` 是 `discriminatedUnion("hookEventName", ...)`，7 分支**各自的字段不同**：

| hookEventName | 该分支允许的字段 |
|---|---|
| `PreToolUse` | `additionalContext?` `permissionDecision?("allow"/"ask"/"deny")` `permissionDecisionReason?` `updatedInput?` |
| `UserPromptSubmit` | `additionalContext?` |
| **`SessionStart`** | **`additionalContext?`（本任务只用这个）** |
| `PostToolUse` | `additionalContext?` |
| `PostToolUseFailure` | `additionalContext?` |
| `PermissionRequest` | `decision?` —— **没有 `additionalContext`** |
| `Stop` | `additionalContext?` |

- **`SessionStart` 与 `Stop` 的 `additionalContext` 是 push 累积**（源码：
  `case Tl.SessionStart: case Tl.Stop: t.additionalContext && e.additionalContexts.push(t.additionalContext)`）。
  ⇒ 与 `session-rules.mjs` 各发一块，**互不覆盖**，无需合并进同一段。
- 现成 helper 已具备：`hooks/lib/io.mjs` 的 `emitContext(eventName, text)` / `emitPass()`。
  **直接复用，不要另写。**

### 1.2 插件 hooks.json 的条目 schema（源码 `vrs`）

```js
// process 型
{ type:"process", command:string, enabled?:boolean, args?:string[], timeoutMs?:number, statusMessage?:string }
// command 型（才吃 async / shell）
{ type:"command", command:string, enabled?:boolean, async?:boolean, shell?:true|string, timeout?:number, timeoutMs?:number, statusMessage?:string }
```

现有 `hooks/hooks.json` 用的是 `process` + `${ZCODE_PLUGIN_ROOT}`，照旧。

### 1.3 hook 输入 payload（**部分未验证**）

源码确认存在的键：`hook_event_name`、`session_id`、`permission_mode`、`agent_type`、
`transcript_path` / `transcriptPath`（compat 路径会生成临时 jsonl）。
现有 `session-rules.mjs` 只用 `cwd` + `hook_event_name` 且**已在真实会话可用**（`field()` 优先 snake_case、
回退 camelCase）。

🔴 **`source`（`startup`/`resume`/`clear`/`compact`）未取到证** —— `hooks.json` 的 matcher 写成
`"startup|resume|clear|compact"` 暗示存在对应值，但**匹配对象字段名没在源码里定位到**。
⇒ **先做第 6 节 P1 探测，再写逻辑。** 不要假设字段名。

---

## 2. 配置 schema（`entrypoints`，向后兼容）

### 2.0 配置落点：**双路径**（G1，2026-10-04 二次核验补，头头已拍板）

现有 `loadGuardrails()` 只读 `<repo>/.zcode/guardrails.json`（`plugins/project-guardrails/hooks/lib/guard.mjs:11`
的 `RULES_REL`）。实测该落点在目标仓库**被 `.gitignore` 吃掉**：

```
$ cd D:/Code/stock-agent && git check-ignore -v .zcode/guardrails.json
.gitignore:6:.zcode/*	.zcode/guardrails.json
```

⇒ 配置**不入库** → 新 clone / 换机器即丢 → 与 doc-protocol 的「跨会话 / 跨 agent 接续」目标**直接冲突**。
（**这是上一轮 doc-protocol 覆盖档踩过的同一个坑**：当时从 `.zcode/doc-protocol.md` 迁到 `.agents/doc-protocol.md`。）

**处置：双路径读取，优先可入库的那个。**

```js
// guard.mjs
export const RULES_RELS = [".agents/guardrails.json", ".zcode/guardrails.json"];
```

- 按数组顺序取**第一个存在的**。`.agents/` 实测在 stock-agent **未被忽略**（`git check-ignore` 无输出）⇒ 可入库。
- `.zcode/` 保留为回退，**现有用户零破坏**。
- `g.path` 已回传实际命中的路径（`guard.mjs:75`），`session-rules.mjs:32` 照实显示 —— **无需改该处逻辑**。
- ⚠️ **连带必改**：`hooks/lib/project.mjs:28` 的 `findProjectRoot` 标记集是 `[".git", ".zcode"]` ⇒
  只用 `.agents/` 的仓库会**找不到项目根**。**加上 `.agents`**，改为 `[".git", ".zcode", ".agents"]`。
- ⚠️ **路径逻辑只留一处**：新增 `readGuardrailsFile(root) -> { path, parsed } | null`，
  由 `loadGuardrails()` 与新的 `loadEntrypoints()`（步骤 1）**共同调用**。
  否则两处各写一遍路径解析，加一个候选路径就要改两个地方，必然漂移。
- 两者同时存在时：**`.agents/` 赢**（可入库的优先）。这一点写进 `README.md` 的字段表。

**需同步改的文案（现有文案全部只提 `.zcode/`）**：
`hooks/session-rules.mjs:1`、`hooks/pretooluse-guard.mjs:1`、`hooks/hooks.json:2`（description）、
`README.md:30/39/43`、`commands/guardrails.md:6/46/51/73`、`hooks/lib/guard.mjs:3`。

### 2.1 schema（在 `guardrails.json` 里新增 `entrypoints` 数组）

```json
{
  "version": 1,
  "context": ["..."],
  "rules": [],
  "entrypoints": [
    {
      "id": "handoff-ledger",
      "label": "handoff 待办账本",
      "file": "handoff.md",
      "kind": "markdown-table",
      "from": "## 剩余未完成与遗留事项",
      "statuses": ["🔴", "🟡", "⏳"],
      "maxRows": 20,
      "maxChars": 1800
    }
  ]
}
```

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `id` | 否 | `file` | 仅用于诊断信息 |
| `label` | 否 | `id` | 注入块标题 |
| `file` | **是** | — | 相对**仓库根**的路径（与配置本身放 `.agents/` 还是 `.zcode/` **无关**）。**必须拒绝绝对路径与含 `..` 的路径**（插件是全局的，路径不可信） |
| `kind` | 否 | `markdown-table` | v1 只支持这一个值；其它值 → 该条静默跳过 |
| `from` | 否 | — | 起始标题，**前缀匹配**；找不到 → 从文件头开始 |
| `to` | 否 | 下一个同级或更高级标题 | 结束边界 |
| `statuses` | 否 | `["🔴","🟡","⏳"]` | 只保留这些状态的行 |
| `maxRows` | 否 | `20` | 硬上限 |
| `maxChars` | 否 | `1800` | 单条上限，**硬上限 4000**（超出按 4000） |

规范化规则（与 `loadGuardrails()` 现有风格一致）：**任何字段非法 → 丢弃该条 entry，不抛错**；
整个 `entrypoints` 非法 → 当作空数组。`entrypoints` 不存在 → 行为与 v1.0.0 完全一致。

---

## 3. 解析规格（`kind: "markdown-table"`）—— 逐条可测

输入：`<repo>/<file>` 的 UTF-8 全文（`readFileSync`）。
**硬约束：只读，绝不写回 `handoff.md`。**

1. 文件不存在 / 读失败 → 跳过该 entry，**不产生任何输出**（fail-open）。
2. **切区间**：找到第一个以 `from` **开头**的行（trim 后 `startsWith`）；取其后到下一个标题行。
   标题行 = `/^#{1,6}\s/`。若 `from` 给的是 `## X`，则级别 ≤ 2 的标题为结束边界；`from` 缺失 → 从第 0 行起。
3. **表格行** = `/^\s*\|.*\|\s*$/`。
4. **跳过表头分隔行** = `/^\s*\|[\s:|-]+\|\s*$/`。
5. **取单元格**：`line.split("|")`，丢弃首个与末个空串，其余 `trim()`。
6. **完成判定**：第 1 格**含成对 `~~`** → 视为已完成，**丢弃**。
   （实证：`stock-agent/handoff.md` 全文 `~~` 292 处，该约定真在用。）
7. **状态判定**：在第 1、2 格中查找 `🔴 / 🟡 / ⏳ / ✅ / ❌`，取**最先出现**的那个。
   - 命中 `statuses` → 保留；命中但不在 `statuses` → 丢弃。
   - **一个都没命中 → 丢弃，但要计数**（对应审查发现：59 行账本里 12 行无状态符号）。
8. **标题提取**：第 1 格剥掉 `~~`、`**`、首尾 emoji 与空白，压缩连续空白，截断到 **80 字**。
9. **⏳ 到期判定**：从第 1 格用 `(\d{2})-(\d{2})` 抓 `MM-DD`，补**本年度**，早于今天 → 标记 `⏳过期 N 天`。
   ⚠️ 年份是**推断**的（`handoff.md:171` 的 D1 是 `09-25` 形式）。跨年条目会误判 →
   **必须在注入块里注明年份为推断**（见 4 节末句）。
10. **排序**：`🔴` → `⏳过期` → `🟡` → `⏳`；同级保持原文顺序。
11. **截断**：先 `maxRows`，再 `maxChars`（**整行丢弃，不截半行**）；发生丢弃时追加汇总行。

---

## 4. 注入文本格式（逐字规格，实施时按此字符串拼）

```
[entrypoints] handoff 待办账本（handoff.md:11-70）待办 23 项：
- [🔴] 38号 FactorLab 重设计处置核查（09-28 用户令「检查是否修改正确」）
- [⏳过期 9 天] D1 验证点（09-25）
- [🟡] 39号 P3 第二批（判据进图余五处）
...
（共 47 行，已显示 20 行；另有 12 行无状态符号未列出）
读取正文用 Read 工具。本块是索引，不是真值；年份为推断，以正文为准。
```

**格式规则：**

| 规则 | 理由 |
|---|---|
| 每行 `- [状态] 标题`，状态**原样**用 emoji（含 `⏳过期 N 天` 变体） | 与 `handoff.md` 的状态词表一致，人眼可对 |
| 首行必带 `（<file>:<起>-<止> 行）` | 让 agent 能直接 `Read offset/limit`，不必先 grep |
| **末句必须存在**：「本块是索引，不是真值；年份为推断，以正文为准。」 | doc-protocol 的核心法是「每类事实只有一个权威载体」。本块是**指针**，不是副本。少了这句就变成抄数字 |
| 汇总行只在**发生截断**时输出 | 无截断时别加噪音 |
| 无 `entrypoints` / 无任何可列行 → **不发任何输出**（`emitPass()`） | 空块会白吃 token，且让「没配」看起来像「配了但坏了」 |

**长度预算**：单条 ≤ `maxChars`（默认 1800，硬上限 4000）；多个 entry 的**总** ≤ 6000
（超出按顺序丢弃靠后的 entry，并在末尾注明）。SessionStart 注入每会话都吃一次，必须有天花板。

---

## 5. 实施步骤（按序）

### 步骤 0 — 配置落点改双路径（G1，**先做**，步骤 1 依赖它）

1. `hooks/lib/guard.mjs:11`：`RULES_REL` → `RULES_RELS = [".agents/guardrails.json", ".zcode/guardrails.json"]`。
2. 抽 `readGuardrailsFile(root) -> { path, parsed } | null`（遍历 `RULES_RELS`，取首个存在且可解析的）；
   `loadGuardrails()` 改为调它（对外签名 `loadGuardrails(root)` 不变）。
3. `hooks/lib/project.mjs:28`：标记集加 `.agents`。
4. 同步 §2.0 列出的 8 处文案。

> 现有行为**不得变**：无 `.agents/` 时仍读 `.zcode/`；两个都没有时 `loadGuardrails` 仍返回 `null` → 放行。

### 步骤 1 — 新增 `hooks/lib/entrypoints.mjs`
导出两个函数（纯函数，便于直测）：

```
loadEntrypoints(root)            -> Entry[]        // 规范化；非法项丢弃
buildEntrypointBlocks(root, specs) -> { blocks: string[], diag: {...} }
```

`loadEntrypoints` 调**步骤 0 的 `readGuardrailsFile(root)`** 拿已解析的 JSON（路径逻辑只一处，
双路径自动继承），**只取 `entrypoints` 字段**，不做 `context`/`rules` 的二次解析（避免与现有函数耦合）。
`buildEntrypointBlocks` 返回**已拼好的字符串数组**（一条 entry 一个块），`diag` 里带丢弃原因，供调试但不注入。

**路径安全**（必须实现，且必须有测试）：`file` 必须满足
`resolve(root, file)` 的结果 `startsWith(resolve(root) + sep)` 且 `file` 不是绝对路径。

### 步骤 2 — 新增 `hooks/session-entrypoints.mjs`（约 20 行）

```js
// SessionStart 钩子 —— 把 <repo>/.zcode/guardrails.json 的 entrypoints 指向的待办账本注入上下文。
//
// 补的是这个缺口：技能是按需工具调用、开场不加载；本钩子在**开场**把「欠着什么」推到模型面前。
// 与 session-rules.mjs 的分工：它注入静态约定(context)，本文件注入活账本摘要。
// 两者都往 additionalContexts push，互不覆盖。
import { readStdinAsync, field, emitContext, emitPass } from "./lib/io.mjs";
import { resolveProject } from "./lib/project.mjs";
import { loadEntrypoints, buildEntrypointBlocks } from "./lib/entrypoints.mjs";

const payload = await readStdinAsync();
if (field(payload, "hook_event_name", "hookEventName") !== "SessionStart") emitPass();

const cwd = field(payload, "cwd") || process.cwd();
let ctx;
try { ctx = resolveProject(cwd); } catch { emitPass(); }
if (ctx.isHome) emitPass();

// fail-open：任何异常都静默放行，绝不让开场失败
try {
  const specs = loadEntrypoints(ctx.root);
  if (!specs.length) emitPass();
  const { blocks } = buildEntrypointBlocks(ctx.root, specs);
  if (!blocks.length) emitPass();
  emitContext("SessionStart", blocks.join("\n\n"));
} catch { emitPass(); }
```

**为什么另起一个文件而不是塞进 `session-rules.mjs`**：独立失败域（账本解析出错不影响约定注入）、
独立 timeout、`session-rules.mjs` 零回归。代价是每会话多一个 node 进程（SessionStart 每会话一次，可忽略）。

### 步骤 3 — `hooks/hooks.json` 增加第二个 SessionStart 条目

在 `hooks.SessionStart` 数组里**追加**（保持现有条目原样）：

```json
{
  "matcher": "startup|resume|clear|compact",
  "hooks": [
    {
      "type": "process",
      "command": "node",
      "args": ["${ZCODE_PLUGIN_ROOT}/hooks/session-entrypoints.mjs"],
      "timeoutMs": 5000
    }
  ]
}
```

⚠️ 同时把 `hooks.json` 顶部的 `"description"` 补上 entrypoints 一句（它同时是给人和给模型看的说明），
并把其中的 `<repo>/.zcode/guardrails.json` 更正为**双路径**表述（G1/G5 同处一行）。

### 步骤 4 — 版本与登记三处同步（漏一处就装不上/不生效）

| 文件 | 字段 | 值 |
|---|---|---|
| `plugins/project-guardrails/.zcode-plugin/plugin.json` | `version` | `1.1.0` |
| `plugins/project-guardrails/.zcode-plugin/plugin.json` | `description` | 补 entrypoints 一句；**同时把「work around ZCode ignoring workspace-scoped hooks」改写**（见步骤 6） |
| 根 `marketplace.json` | `plugins[]` 中 `project-guardrails.version` | `1.1.0` |

**另外必须做（2026-10-04 实测发现的阻塞项）**：市场快照 `~/.zcode/cli/plugins/marketplaces/zcode-plugin/`
与 `known_marketplaces.json` 的 `pluginCount: 1` **只有 `skill-forge`** ⇒ 本插件**从未可装**。
必须先在 GUI **刷新市场**，再谈安装。这一条不解决，做了也装不上。

### 步骤 5 — 文档同步

| 文件 | 改什么 |
|---|---|
| `plugins/project-guardrails/README.md` | 加 `entrypoints` 一节：schema 表 + 一个 `handoff.md` 完整示例 + 「这是索引不是副本」的设计理由；**规则文件一节补双路径（`.agents/` 优先）+ 一条 `git check-ignore` 自检提示** |
| `plugins/project-guardrails/commands/guardrails.md` | 步骤 2 的分派加一项 `entrypoints`：列出当前配置、加/删一条、并**自动探测**候选账本（找仓库里含 `^## ` 标题 + 表格 + 状态 emoji 的 md） |
| 根 `README.md` | 插件表 `project-guardrails` 行补「+ 会话开场注入待办账本（entrypoints）」；「补什么缺口」表补一行 |

### 步骤 6 — 顺带更正「工作区 hooks 不执行」（2026-10-04 取源更正）

源码 `IQs()` 给项目级 hook 挂 `admission → evaluateDispatch()`；`TQs()` 给插件/配置 hook **直接派发、无准入**。
`trustState` 枚举含 **`trusted_persistent`**（可持久信任），拒绝原因是
`workspace_hooks_pending_trust` / `_blocked_by_policy` / `_bundle_changed` / `_snapshot_mismatch` /
`_policy_requires_pretrust` / `_trust_store_corrupt` / `_config_unreadable`。

⇒ 正确表述是「**默认待信任 + hook 摘要一变即失效**」，不是「fail-closed / 根本不执行」。

需改的 **10 个文件**（**改措辞，不改结论方向**——用户级插件仍然更可靠、免逐仓库信任）：
`README.md`（:16 / :37 / :75 / :272 / :286）、`HANDOFF.md:345`、
`marketplace.json`（description 内）、`plugins/project-guardrails/.zcode-plugin/plugin.json`（description）、
`plugins/project-guardrails/commands/guardrails.md:10`、
`plugins/project-guardrails/hooks/lib/guard.mjs:4`、`hooks/session-rules.mjs:3`、`hooks/pretooluse-guard.mjs:1`、
`plugins/project-guardrails/hooks/hooks.json:2`、
`docs/analysis/zcode-capability-gaps.md`（:22 / :104-108 / :159 / :171）。

### 步骤 7 — 在目标仓库创建配置（G2，**由头头手动**，不异动 stock-agent）

任务单其余部分都假设「配置已存在」，但实测：

```
$ ls -la D:/Code/stock-agent/.zcode/
plans/  skills/          # ← 没有 guardrails.json
```

§6-A1 断言 `cwd=stock-agent` 时 stdout 含 `[entrypoints]` —— **没有这一步，A1 必然失败**。
所以要在目标仓库落一份配置（**这一步由头头执行，任务单作者不动任何仓库**）：

```bash
mkdir -p D:/Code/stock-agent/.agents
cat > D:/Code/stock-agent/.agents/guardrails.json <<'JSON'
{
  "version": 1,
  "entrypoints": [
    {
      "id": "handoff-ledger",
      "label": "handoff 待办账本",
      "file": "handoff.md",
      "kind": "markdown-table",
      "from": "## 剩余未完成与遗留事项",
      "statuses": ["🔴", "🟡", "⏳"],
      "maxRows": 20,
      "maxChars": 1800
    }
  ]
}
JSON
# 自检：必须无输出（有输出=被忽略=白配）
cd D:/Code/stock-agent && git check-ignore -v .agents/guardrails.json
```

`from` 的值已实测核对：`handoff.md:7` = `## 剩余未完成与遗留事项（跨会话追踪）`，**前缀匹配成立**；
账本区间 `:7~:66`（下一个 `##` 在 :66）= 59 行。

---

## 6. 验收判据（可复跑，逐条给命令与期望）

先做两条**前置探测**，再跑验收。

### P1 — 探测 SessionStart payload 真实字段（**必做，阻塞逻辑编写**）
临时（不提交）在 `session-entrypoints.mjs` 顶部加：
```js
import { writeFileSync } from "node:fs";
writeFileSync("<repo>/.zcode/_payload-probe.json", JSON.stringify(payload, null, 2));
```
然后**分别**触发一次冷启动（`startup`）与一次 `/clear`，对比两份 dump：
- 断言存在 `cwd`、`hook_event_name`；
- **确认 matcher 匹配的是哪个字段**（找 `/startup|resume|clear|compact/` 的候选值）；
- 记下 `session_id` 等键名大小写（`field()` 依赖这个）。
探测完**删掉探针与文件**。

### P2 — 真实负载测量
一次会话里 SessionStart 注入的 `additionalContexts` 总字符数。> 6000 就调小 `maxChars`。

### A 组 — 直调（与 `_probe.sh` 同风格：纯 bash 驱动 `node`，不依赖 ZCode）

> **前置**：**步骤 7 已在目标仓库建好配置**，否则 A1/A2/A6~A9 全部无输出（不是代码错，是没数据）。

| # | 命令 | 期望 |
|---|---|---|
| A1 | `echo '{"hook_event_name":"SessionStart","cwd":"D:/Code/stock-agent"}' \| node plugins/project-guardrails/hooks/session-entrypoints.mjs` | stdout 含 `[entrypoints]`，含 `- [🔴]`/`- [🟡]`/`- [⏳`，exit **0**，是**合法 JSON** |
| A2 | 同上跑两次，逐字节 `diff` | 一致（唯一例外：`⏳过期 N 天` 随日期变，需在测试里固定日期或忽略该字段） |
| A3 | `cwd` 指向**两个落点（`.agents/` 与 `.zcode/`）都无** `guardrails.json` 的目录 | **空 stdout** + exit 0 |
| A4 | `entrypoints[0].file` 指向不存在的文件 | 该条静默跳过；**若还有第二条合法 entry，它仍被注入** |
| A5 | `file: "../../../etc/passwd"` | 该条被拒；**断言 stdout 不含其任何内容** |
| A6 | `maxRows: 3` | 恰好 3 行账本 + 1 行汇总 |
| A7 | `maxChars: 200` | 输出 ≤ 200 字符 + 汇总行 |
| A8 | 找一个 `~~...~~` 完成行 | 断言其标题**不出现**在输出里 |
| A9 | 计数一致性 | 用**独立的第二个脚本**数出期望行数，与实测比对（**不要复用被测函数**，否则同源假绿） |
| A10 | 回归 | `session-rules.mjs` / `pretooluse-guard.mjs` 原有 35 项直调全绿 |
| A11 | JSON 合法性 | 所有 A 组输出 `JSON.parse` 通过，且 `hookSpecificOutput.hookEventName === "SessionStart"` |
| A12 | **双路径优先级**：同一仓库同时放 `.agents/guardrails.json`（entrypoints 合法）与 `.zcode/guardrails.json`（内容不同） | 用的是 **`.agents/`** 那份；`g.path` 显示 `.agents/…` |
| A13 | **只用 `.agents/` 的仓库**（临时把 `.zcode/` 改名） | 仍能解析出项目根并注入（验证 `findProjectRoot` 已认 `.agents`）；不存在时不报错、空 stdout |

### B 组 — 反向变异（防假绿灯，**必须做**）

审查里反复出现的失效模式是「守卫存在但结构上无法命中」。所以每条过滤逻辑都要有一条**注入反例后必须失败**的断言：

| # | 变异 | 期望 |
|---|---|---|
| B1 | `statuses: ["🔴"]` | 🟡 / ⏳ 行**消失**（证明过滤真在跑，不是恰好没数据） |
| B2 | `from` 改成不存在的标题 | 输出变空或退化为全文件（二选一，但**必须与规格一致可预测**） |
| B3 | 故意把某行改成无状态符号 | 该行不出现，且汇总行的「无状态符号」计数 **+1** |
| B4 | 把 `maxChars` 设成 50 | 汇总行仍完整、输出仍是合法 JSON（证明截断不劈坏结构） |

### C 组 — 真实会话（端到端，**唯一能证明接入层的**）

C1. 在 `stock-agent` 起一个新会话，**只说「继续」**。
C2. **断言：模型在第一次回复里就点出账本里的 🔴 项**（不需要用户提醒、不需要模型主动调 `doc-protocol`）。
C3. 对照：临时禁用本插件再跑一次 → 应当**答不出**。这一对照是证明「本钩子确实接通了接入层」的唯一手段。
C4. 记录 `hookCount`（应从 2 增到 3）。

---

## 7. 明确不做（写下来免得后面反复讨论）

| 不做 | 理由 |
|---|---|
| `Stop` hook 做「本轮写了文档但账本没动」的 nudge | ①Stop 每轮触发，解析开销 × 每轮 ②「是否写了文档」无法机械判定 —— `doc-protocol` 自己已声明「能机械检查的只有结构」③需要先有可靠信号源。**二期** |
| 自动修改 `handoff.md` | 只读。账本由人/会话按 doc-protocol 纪律维护 |
| 把 `SKILL.md` 复制进插件 | 两份必然漂移。本钩子只注入**索引**，正文仍由 `~/.agents/skills/doc-protocol/` 提供 |
| 让"账本文件名/路径"可配到任意盘符 | 只许仓库根内相对路径（插件是全局的） |
| 把 `entrypoints` 做成独立插件 | 会新增第 4 个活动部件；现有 SessionStart 通道已够 |

---

## 8. 未验证清单（实施者别当成已知）

| # | 未验证项 | 影响 |
|---|---|---|
| U1 | SessionStart payload 里触发源字段的名字 | **阻塞**步骤 2 的 matcher 判断 → 由 P1 探测解决 |
| U2 | matcher 的匹配对象（字段/值形态） | 影响 matcher 写法；不改 matcher 也不影响功能（本钩子不依赖 matcher 过滤） |
| U3 | `⏳` 行 `MM-DD` 的年份推断 | 跨年账本会误判「过期」→ 已在注入块末句免责 |
| U4 | 多 entry 的注入块顺序稳定性 | 理论 = 注册顺序，需实测 |
| U5 | 注入块的真实 token 开销 | 由 P2 测量 |
| U6 | 主路径下同名技能（用户级 vs 插件）的裁决方式 | 与本任务无关，但影响「要不要把技能也塞进插件」的决策 |
| U7 | `.agents/guardrails.json` 是否会被**其它 agent 工具**（Codex / Claude 等）当成自己的配置误读或报错 | 未验证。`.agents/` 是跨工具约定根，插件往那放一个自有 JSON 属**借用**；若冲突则退回落点需重议 |
| U8 | `findProjectRoot` 加 `.agents` 标记后，**对现有用户的行为变化** | 理论只影响「有 `.agents/` 但无 `.git`/`.zcode`」的仓库（此前会往上找父根，现在就地停）。需在 A13 覆盖 |

---

## 9. 交给实施者的最小行动清单

1. **步骤 0** — 配置落点改双路径（含 `project.mjs` 加 `.agents`、抽 `readGuardrailsFile`、8 处文案）。**先做**。
2. 先做 **P1 探测**（阻塞项），把 SessionStart payload 打成 dump 看一遍。
3. 写 `hooks/lib/entrypoints.mjs` + `hooks/session-entrypoints.mjs`（第 2、3、5 节规格）。
4. 改 `hooks/hooks.json` 加第二个 SessionStart 条目。
5. 三处 version 同步到 `1.1.0`。
6. **步骤 7** — 在目标仓库建 `.agents/guardrails.json`（**头头手动**，不异动 stock-agent）。
7. 跑 A1–A13 + B1–B4；**B 组全红才算过**。
8. **先在 GUI 刷新市场**，再重装插件，开新会话跑 C1–C4。
9. 同步文档（步骤 5）+ 更正措辞（步骤 6，10 个文件）。
