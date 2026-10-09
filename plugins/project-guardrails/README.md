# project-guardrails

给**单个项目**声明约定、工具规则与会话开场索引，由**用户级**插件负责注入与执行。

## 它补的是哪个缺口

ZCode 对工作区级资源的处理是不一致的（源码确认）：

| 资源 | 工作区级的待遇 |
|---|---|
| MCP servers | 自动信任、自动连接 |
| **Hooks** | **默认处于「待信任」** —— 需显式信任才执行（`trustState: pending_trust`），`trusted_persistent` 可持久；一旦 `bundleDigest` / `hookDeclarationDigest` 变化即 `stale_digest` 失效。**插件与用户级配置的钩子则直接派发、不过这道闸** |
| Skills / commands | 会加载，但被用户级同名**遮蔽** |
| `AGENTS.md` | 会加载，且后可覆盖 |

⇒ 后果：**项目想自带行为约束，门槛很高** —— 每个仓库都得先解决「信任」，换个工作区、
改一次钩子声明就重来一遍。而 `AGENTS.md` 只能写静态文字，管不住工具调用，也**不会**在开场
把项目的待办与体量状态推进上下文。

本插件是**用户级**的（钩子直接派发，不需要逐仓库信任），代替工作区钩子去读项目里的声明文件 ——
于是「项目说了算」重新成立。它在任何项目里都能生效，但只在**该项目的声明存在时**才介入。

而「声明」**可以不写**：`entrypoints`（开场索引）走**约定优于配置** —— 仓库里有账本载体文件时
自动生效，零配置。详见下方「零配置开箱即用」。

## 三个钩子、三件事

| 钩子 | 事件 | 做什么 |
|---|---|---|
| `session-rules.mjs` | `SessionStart` | 注入 `context[]`（项目约定，纯文本） |
| `session-entrypoints.mjs` | `SessionStart` | 注入 `entrypoints[]`：**待办账本索引 + 体量状态**（见下） |
| `pretooluse-guard.mjs` | `PreToolUse` | 按 `rules[]` 做 `deny` / `ask` |

两个 `SessionStart` 条目**刻意分开**：独立失败域，一个挂了不影响另一个。
`additionalContext` 是 **push 累积**的（源码 `case Tl.SessionStart: …push`），互不覆盖。

## 与全局 `guard-bash.js` 的关系

**并存、不替代。** 分工：

| | 用户级 `~/.zcode/hooks/guard-bash.js` | 本插件 |
|---|---|---|
| 范围 | 全局兜底，对所有项目一样 | 项目级增量，只在该项目生效 |
| 内容 | 灾难性命令黑名单（`rm -rf /`、fork bomb…） | 该项目的约定（用哪个包管理器、别写 `.env`…） |
| 载体 | 硬编码在脚本里 | `<repo>/.agents/guardrails.json`（或 `.zcode/`），可随仓库进 git |

两者都挂在 `PreToolUse` 上。多方决策按 **`deny` > `ask` > 其它** 归并，
`additionalContext` 是累积的 —— 所以叠加不会互相干扰。

## 安装

在市场里 Install `project-guardrails` → **开新会话**（hooks 在会话启动时快照）。

开箱即用的那部分（开场索引）**不用做任何事**。只有当你要加 `context` / `rules`，
或要改 / 关掉 `entrypoints` 时，才需要配置文件 —— 跑 `/guardrails init` 生成，或照下面手写。

## 零配置开箱即用

**装了插件 + 仓库里有账本载体文件（默认 `handoff.md`）= 开场自动注入账本索引与体量摘要。**
不需要任何配置文件。

凭什么能零配置：`entrypoints` 的要素里，除了「阈值」本来就都是**约定**而不是偏好 ——

| 要素 | 为什么能约定 |
|---|---|
| 载体文件名 | doc-protocol 的约定就是 `handoff.md` |
| 区间起止 | 约定就是「首个二级标题 → 首个日期标题」 |
| 状态符号 | 约定就是 `🔴 🟡 ⏳` |
| 阈值 | 已在 `<repo>/doc-budget.json`，无则内置 `DEFAULTS` |

这些常量原本**就已经写在 `BUDGET_DEFAULTS` 里了**，只是过去没有出口：
`loadEntrypoints` 在配置缺失时直接返回 `null`，于是要求人把同样的内容再抄一遍成 `entrypoints[]`
才肯生效 —— 那不算「配置」，算重复劳动。

三级裁定：

| 情况 | 行为 |
|---|---|
| 没写 `entrypoints`（或整个配置文件不存在） | **用内置约定集** |
| 写了 `entrypoints: [...]` | 完全听配置的（显式优先） |
| 写了 `entrypoints: []` | **明确关掉** —— 「没写」≠「写空」，否则就没有关掉它的办法 |

内置约定集是**全有或全无**的：以「账本载体存在」为唯一约定标志，载体不在 → 整个默认集不生效。
否则任何有 `AGENTS.md` 的仓库都会每会话多出一行体量摘要 —— 那是噪声，不是信号。
自限性还有第二层：解析不出任何带状态符号的行时同样不输出。

注入块会**声明自己的来源**并给出出口，免得用户看到凭空出现的块不知道从哪来、怎么关：

```
…本块是索引，不是真值；年份为推断，以正文为准。（内置约定；可用 guardrails.json 的 entrypoints[] 覆盖或关掉。）
```

**为什么 `context[]` / `rules[]` 不跟着零配置**：它们的前提**不可推断**，不是格式问题。
`context[]` 是**人的项目约定**（而且 `AGENTS.md` 已被 ZCode 自己确定性注入，再经它注一遍是重复）；
`rules[]` 是**人的 deny/ask 意图**。猜不得，所以保持显式。真正「格式即约定」的只有 `entrypoints`。

## 配置文件：两个落点，前者优先

```
<repo>/.agents/guardrails.json     ← 首选（跨 agent 共享目录；实测未被常见 .gitignore 吃掉）
<repo>/.zcode/guardrails.json      ← 回退
```

插件按序读**第一个存在且可解析**的那个（`.agents/` 坏了会继续试 `.zcode/`）。
两个都没有 → `context` / `rules` 不生效，但 `entrypoints` 仍按**内置约定集**工作（见上）。

> **为什么不只用 `.zcode/`**：很多仓库的 `.gitignore` 里有 `.zcode/*`（如 `stock-agent`），
> 配置**入不了库** ⇒ 换台机器就丢，与「跨会话接续」直接冲突。
> 落盘后务必自检：`git check-ignore -v .agents/guardrails.json` —— **必须无输出**。

### `context[]` 与 `rules[]`

```json
{
  "version": 1,
  "context": [
    "本项目用 pnpm，不要用 npm",
    "提交信息用中文，不加 Co-Authored-By"
  ],
  "rules": [
    {
      "tool": "Bash",
      "pattern": "\\bnpm\\s+(install|i|add)\\b",
      "action": "deny",
      "reason": "本项目用 pnpm，npm install 会写出 package-lock.json"
    },
    {
      "tool": "Write",
      "pattern": "\\.env$",
      "action": "ask",
      "reason": "确认：这是要写 .env 吗？"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `context[]` | 纯文本约定，`SessionStart` 注入。**没有任何工具限制** |
| `rules[].tool` | 工具名，大小写不敏感。`*` 或省略 = 所有工具；也支持 `Bash\|Write` |
| `rules[].pattern` | 正则。默认忽略大小写，`"ignoreCase": false` 可关闭 |
| `rules[].action` | `deny`（拦截）或 `ask`（请求确认）。**其它值一律忽略** |
| `rules[].reason` | 拦截时展示的理由 |

**匹配的文本**：`Bash` 匹配 `command`；写文件类工具匹配 `file_path` 与内容字段；
都取不到时退化为整个 `tool_input` 的 JSON。单次匹配上限 20000 字符。

### `entrypoints[]` —— 会话开场索引

补的是**另一个**缺口：技能（skills）是**按需调用的工具**，开场不会自动加载。
于是新会话只丢一句「继续」时，模型根本看不到项目的待办账本。`SessionStart` 注入是**确定性**的。

**这一段不是必需的** —— 不写就按「零配置开箱即用」的内置约定集走。写它是为了：
改 `file` / `from` / `to`、加更多块、收窄 `statuses`，或者用 `[]` 把它关掉。

```json
{
  "version": 1,
  "entrypoints": [
    {
      "id": "handoff-ledger",
      "label": "handoff 待办账本",
      "kind": "markdown-table",
      "file": "handoff.md",
      "from": "## 剩余未完成与遗留事项",
      "statuses": ["🔴", "🟡", "⏳"],
      "maxRows": 20,
      "maxChars": 1800
    },
    { "id": "budget", "label": "体量状态", "kind": "budget", "config": "doc-budget.json" }
  ]
}
```

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `id` | — | — | **必填**，诊断用 |
| `label` | 否 | `id` | 注入块的标题 |
| `kind` | 否 | `markdown-table` | `markdown-table` 或 `budget` |
| `file` | table 必填 | — | 相对**仓库根**。**绝对路径与含 `..` 一律拒绝** |
| `from` / `to` | 否 | — / 下一个**同级或更高级**标题 | 正则优先、编译失败回退字面量前缀 |
| `statuses` | 否 | `["🔴","🟡","⏳"]` | 只保留这些状态的行 |
| `maxRows` / `maxChars` | 否 | `20` / `1800`（硬上限 4000） | 见下 |
| `config`（budget） | 否 | `doc-budget.json` | 阈值来源，见下 |

**四条硬规则**（都是踩出来的）：

1. **只读。** 绝不写回 `handoff.md` 或任何文件。注入块是**索引不是副本** ——
   每条带 `（file:起-止 行）` 与标题摘要，正文永远靠 `Read` 回填。
   这是「每类事实只有一个权威载体」的延伸：本块是**指针**，不是第二份真值。
2. **完成行不出现。** 前两格含成对 `~~` 的行被丢弃（「未完成投影」不变量）。
   注意**有状态符号但被 `statuses` 过滤**的行（如 `✅`）是静默丢弃、**不计入**「无状态」，
   只有**一个状态符号都没有**的行才计数。
3. **`from` 的终止是「同级或更高级标题」**，不是「任意标题」。真实账本的表格常挂在
   `### 子分组` 之下（`## 剩余未完成…` → `### 规划内剩余…` → 表格）；按任意标题截断会让
   **表格整个读不到**。
4. **标题取自前两格里「剥掉状态符号后更长」的那一格。** 真实仓库两种列序并存：
   `| 🔴 **事项** | 待开工 | 说明 |`（状态与事项同格）与 `| 🔴 待办 | 事项 | 来源段 |`；
   取更长者对两者都成立。

**`kind: "budget"`** —— 把「账本 N KB / 交接 N 行 / 已越线」推到模型面前，让回弹**在越线前可见**：

```
[entrypoints] 体量：handoff 2065 行/637 KB(超) · AGENTS 92 KB(超) · 活账本 90 KB(超 6×, 26 死行)
```

阈值来自 `<repo>/doc-budget.json` —— 与
[`skills/doc-protocol/assets/check-doc-budget.py`](../../skills/doc-protocol/assets/check-doc-budget.py)
的 `--config` **是同一个文件**（单一真源）。没有该文件时退回内置 `DEFAULTS`，
其值须与脚本的 `DEFAULTS` 相等，由测试断言守住（见下）。

> 为什么阈值必须单一真源：同一个量被两处计算（收尾时的 Python 闸 / 开场时的 Node 注入），
> 各自硬编码一份常量必然漂移。这与「把 SKILL.md 复制进插件 = 两份必漂移」是同一个道理。

**长度上限**：单条 ≤ `maxChars`（默认 1800，硬上限 4000）；多 entry **总** ≤ 6000。
SessionStart 每会话吃一次 token，必须有天花板。超长标题截到 80 字并加 `…`。

**任何字段非法都不抛错**：结构非法（缺 `id`、`kind` 未知、`file` 缺失/绝对/含 `..`）→
**丢弃该条**；可选字段非法（`maxRows` 非数）→ **回退默认值**。

## 命令

| 命令 | 作用 |
|---|---|
| `/guardrails init` | 从 `AGENTS.md` / 近期提交里拟出约定，写入 `context`（`rules` 留空） |
| `/guardrails check` | 只校验不改：JSON 能否解析、每条 `pattern` 能否编译、`action` 是否合法 |
| `/guardrails <一段描述>` | 把它翻译成规则，**说明可能误伤什么并得到确认后**才写入 |

## 怎么验证它在工作

```bash
# 1. 会话顶部是否出现 [guardrails] 或 [entrypoints] 前缀
# 2. 在项目里试一条会被拦的命令，例如被规则禁止的包管理器
```

直调测试（不需要装插件、不需要开新会话）：

```bash
NODE=/path/to/node PY=/path/to/python bash plugins/project-guardrails/test/entrypoints.test.sh
```

覆盖 A 组（含 **A14 阈值合流**：hook 与 Python 脚本对同一仓库输出的共同子集必须相等）
与 B 组反向变异。

## 设计决策（为什么这么做）

- **fail-open，不是 fail-closed。** 规则文件坏了 / 读不到 → 一律放行。
  这是**用户自己写的项目配置，不是安全边界**；为了它把整个会话卡死是荒谬的。
- **坏正则被逐条忽略，不影响同文件里其它规则。** 一条写错不该让整份配置失效。
- **默认忽略大小写。** 路径与命令的大小写不该决定规则是否命中。
- **`PreToolUse` 的 `matcher` 故意省略**（= 匹配所有工具），因为规则可以针对任意工具。
  代价是每次工具调用都会启动一次进程 —— 所以脚本的第一件事就是
  「没有规则文件就立刻退出」，把开销压到 node 启动本身（实测约 85 ms）。
  嫌慢可以在 `hooks.json` 里把 matcher 收窄成 `"Bash|Write|Edit"`。
- **`deny` 不是默认推荐。** 大多数情况 `ask` 更合适 —— 把判断权留给当下的人，
  而不是写死在配置里。一条误伤正常流程的 `deny` 会让人直接关掉整个插件。
- **`cwd` 落在 home 时一律跳过。** 否则规则会意外地对所有会话生效。
- **配置的门槛按「信息能否推断」分，不按「功能大小」分。** `entrypoints` 的载体名 / 区间 /
  状态符号都是 doc-protocol 的约定 ⇒ 零配置；`context` / `rules` 是人的意图 ⇒ 显式。
  过去三者挤在一个文件里、又共用「文件必须存在」这一道闸，于是 `entrypoints` 白白要求人抄一遍。
- **`entrypoints` 不做 `source` 分流。** `SessionStart` 的 `source`（`startup`/`resume`/…）
  原样可读（payload 是 `{...e, …别名}` 全量 spread），但**任何一次会话开始都该注入**
  —— compact 之后更需要。按 source 过滤只会漏。

## 已知限制（未验证项，别当结论）

- **装好后没有在真实会话里跑过。** 直调断言覆盖了各钩子的行为，
  但「ZCode 在真实工具调用前会调用本钩子」这一步没有实测证据。
- **`clear` / `compact` 是否真的触发 `SessionStart` 未实测。** 源码里只找到
  `runSessionStartHooks("startup", …)` 与 `runSessionStartHooks("resume", …)` 两个调用点；
  `hooks.json` 的 matcher 仍写着 `startup|resume|clear|compact`（多写不报错）。
- **这不是安全边界，是防手滑。** 删掉规则文件、或换个工具绕过正则，都能规避。
  密钥、权限之类的事不要指望它。
- **正则能力没有沙箱。** 复杂的用户正则可能很慢（ReDoS）；目前只做了
  「匹配文本截断到 20000 字符」这一层防护。
- **`PreToolUse` 上的进程启动开销是真实成本。** 一轮里几十次工具调用会累积成秒级延迟。
  这是省略 matcher 换来的通用性，用不用取决于你更在意哪一边。
- **账本解析器与 `check-doc-budget.py` 是两份实现。** 共同子集由 A14 断言守住，
  但边界行为（如 `~~` 出现在第 3 格之后）两侧未必一致。
- **内置约定集是开着的**（v1.1.1 起）。因此**任何有 `handoff.md` 的仓库**都会在开场收到一段
  账本索引 —— 哪怕那个 `handoff.md` 跟 doc-protocol 无关。自限性靠两层：载体不存在就不进、
  解析不出带状态符号的行就不输出。若某个仓库不想要，写 `"entrypoints": []` 明确关掉。
- **`from` 缺省的语义在 v1.1.1 修正过**：表格块过去是「从文件第 0 行起」，账本块是「从首个二级
  标题起」。现在两处一致（首个二级标题）。v1.1.0 从未安装，无迁移影响。
