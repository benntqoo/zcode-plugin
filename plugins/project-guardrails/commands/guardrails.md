---
description: 管理本项目的 guardrails.json（初始化 / 校验 / 追加规则）
argument-hint: "[init | check | <想加的约束或规则描述>]"
---

管理本项目的 guardrails.json —— 项目级的约定、工具规则与会话开场索引。

## 背景（一句话）

ZCode 里工作区级 hooks **默认处于「待信任」**（源码 `trustState: pending_trust`），需显式信任才执行、
且声明摘要一变即 `stale_digest` 失效，所以「项目自带约束」门槛很高。
本插件是**用户级**的（钩子直接派发），代替工作区钩子去读项目里的这个声明文件，
从而让项目重新说了算。

**配置落点（前者优先）**：`<repo>/.agents/guardrails.json` → `<repo>/.zcode/guardrails.json`。
首选 `.agents/` 是因为不少仓库的 `.gitignore` 吃掉 `.zcode/*`，配置入不了库、换台机器就丢。
落盘后自检：`git check-ignore -v .agents/guardrails.json` **必须无输出**。

## 文件格式

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
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `context[]` | 纯文本约定，会话开始时注入。**不加工具限制**，就是「本该写在 AGENTS.md、但想按项目分文件管理」的那些话 |
| `rules[].tool` | 工具名，大小写不敏感；`*` 或省略 = 所有工具；也支持 `Bash\|Write` |
| `rules[].pattern` | 正则。默认**忽略大小写**，加 `"ignoreCase": false` 可关闭 |
| `rules[].action` | `deny`（拦截）或 `ask`（请求确认）。其它值一律忽略 |
| `rules[].reason` | 拦截时展示的理由，写清楚**为什么**，否则使用者只会想绕过去 |

匹配的文本：`Bash` 匹配 `command`；写文件类工具匹配 `file_path` 与内容字段；
两者都取不到时退化为整个 `tool_input` 的 JSON。单次匹配上限 20000 字符。

## `entrypoints[]`（会话开场索引）

补的是**另一个**缺口：技能是按需调用的工具、开场不会自动加载，新会话只说「继续」时
模型看不到待办账本。`entrypoints` 把账本索引与体量状态在 `SessionStart` **确定性**注入。

**这一段是可选覆盖，不是必需。** 不写时插件按**内置约定集**工作：仓库里有 `handoff.md`
（账本载体，默认名）就自动注入「首个二级标题 → 首个日期标题」区间的账本 + 一行体量摘要。
所以**默认零配置**。写下面这段只为了改 `file` / `from` / `to`、加更多块，或用 `[]` 关掉。

```json
{
  "entrypoints": [
    { "id": "handoff-ledger", "label": "handoff 待办账本", "kind": "markdown-table",
      "file": "handoff.md", "from": "## 剩余未完成与遗留事项",
      "statuses": ["🔴", "🟡", "⏳"], "maxRows": 20, "maxChars": 1800 },
    { "id": "budget", "label": "体量状态", "kind": "budget", "config": "doc-budget.json" }
  ]
}
```

要点（细则见插件 `README.md`）：

- **只读、索引不是副本** —— 注入的是 `（file:起-止 行）` + 标题摘要，正文靠 `Read` 回填。
- **完成行（成对 `~~`）不出现**；`✅` 这类被 `statuses` 过滤的行静默丢弃、不计入「无状态」。
- **`from` 的终止是「同级或更高级标题」** —— 真实账本的表格常挂在 `### 子分组` 之下，
  按任意标题截断会让表格整个读不到。
- **`from` 缺省 = 第一个二级标题**（内置约定集走的就是这条）。
- **阈值单一真源**：`budget` 走的 `<repo>/doc-budget.json` 与
  `skills/doc-protocol/assets/check-doc-budget.py --config` 是**同一个文件**。缺文件则用内置默认值。
- **`entrypoints: []`（空数组）= 明确关掉**；与「不写这个字段」不同，后者会用内置约定集。

## 步骤

1. **定位项目根。** 必须是仓库根 —— 配置文件只在**仓库根**的 `.agents/` 或 `.zcode/` 下被读取
   （前者优先）。

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   echo "root = $ROOT"
   for p in "$ROOT/.agents/guardrails.json" "$ROOT/.zcode/guardrails.json"; do
     [ -f "$p" ] && { echo "found: $p"; cat "$p"; }
   done
   [ -f "$ROOT/.agents/guardrails.json" ] || [ -f "$ROOT/.zcode/guardrails.json" ] || echo "(还没有 guardrails.json)"
   ```

2. **按 `$ARGUMENTS` 分派：**

   - **`init`** —— 读本项目已有的约定来源（`AGENTS.md`、`.agents/`、近期提交），
     拟出 3-8 条**确实会重复用到**的约定写进 `context`，`rules` 先留空数组。
     写完告诉用户「rules 是空的，拦截还没生效」。
     **`entrypoints` 默认不要写** —— 不写就用内置约定集（仓库里有 `handoff.md` 即自动生效），
     写进去反而是把默认值抄一遍。只有当用户**明确要改**载体名 / `from` / `to`，或要**关掉**时，
     才写这一段：改的话给出 `handoff-ledger` 示例并**与用户确认**账本标题（`from`）与状态符号表；
     关掉就写 `"entrypoints": []`。
   - **`check`** —— 只校验不改：JSON 能否解析、每条 `pattern` 能否编译成正则、
     `action` 是否合法。逐条报告，坏的指出**第几条、哪里坏**。**不要顺手修**。
   - **其它（一段自然语言描述）** —— 把它翻译成规则，追加进 `rules`（或 `context`，
     如果它其实是「约定」而不是「要拦的行为」）。加之前先说明你打算写成什么正则、
     会匹配到什么、可能误伤什么，**得到确认再写**。

3. **写完校验一遍**：`node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf-8"))' <file>`

## 铁律

- **正则宁窄勿宽。** 一条误伤正常开发流程的规则，比没有规则更糟 —— 使用者会直接关掉插件。
- **`deny` 要慎用**，大部分情况 `ask` 更合适：把判断权留给当下的人，而不是写死在配置里。
- **这不是安全边界**。它是防手滑，不是防攻击。任何人删掉这个文件就绕过了。
  真安全的事（密钥、权限）不要指望它。
- **优先写 `.agents/guardrails.json`**（可入库、跨 agent 共享）；`.zcode/` 只作回退。
  写完跑 `git check-ignore -v <路径>` —— **必须无输出**，否则配置换台机器就丢。
  只改这一个文件（必要时创建目录）。**不要**动 `AGENTS.md`、不要动源码。
- `context` 里的每条要是**能独立读懂**的一句话 —— 它会被注入到一个没有上下文的新会话里。
