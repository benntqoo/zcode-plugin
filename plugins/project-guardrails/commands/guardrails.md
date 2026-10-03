---
description: 管理本项目的 guardrails.json（初始化 / 校验 / 追加规则）
argument-hint: "[init | check | <想加的约束或规则描述>]"
---

管理 `<repo>/.zcode/guardrails.json` —— 项目级的约定与工具规则。

## 背景（一句话）

ZCode **不执行工作区级 hooks**（安全策略，源码里 fail-closed），所以「项目自带约束」原本做不到。
本插件是**用户级**的，代替工作区钩子去读项目里的这个声明文件，从而让项目重新说了算。

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

## 步骤

1. **定位项目根。** 必须是仓库根 —— 规则文件只在**仓库根**的 `.zcode/` 下被读取。

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   echo "root = $ROOT"
   cat "$ROOT/.zcode/guardrails.json" 2>/dev/null || echo "(还没有 guardrails.json)"
   ```

2. **按 `$ARGUMENTS` 分派：**

   - **`init`** —— 读本项目已有的约定来源（`AGENTS.md`、`.zcode/`、近期提交），
     拟出 3-8 条**确实会重复用到**的约定写进 `context`，`rules` 先留空数组。
     写完告诉用户「rules 是空的，拦截还没生效」。
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
- 只改 `.zcode/guardrails.json`（必要时创建 `.zcode/` 目录）。**不要**动 `AGENTS.md`、不要动源码。
- `context` 里的每条要是**能独立读懂**的一句话 —— 它会被注入到一个没有上下文的新会话里。
