# project-guardrails

给**单个项目**声明约束与工具规则，由用户级插件负责执行。

## 它补的是哪个缺口

ZCode 对工作区级资源的处理是**反的**（源码确认）：

| 资源 | 工作区级的待遇 |
|---|---|
| MCP servers | 自动信任、自动连接 |
| **Hooks** | **一条都不执行** —— fail-closed，`reasonCode = workspace_hooks_blocked_untrusted` |
| Skills / commands | 会加载，但被用户级同名**遮蔽** |
| `AGENTS.md` | 会加载，且后可覆盖 |

⇒ 后果：**项目无法自带行为约束**。想给某个仓库加个「守卫」，`AGENTS.md` 只能写静态文字，
管不住工具调用。

本插件是**用户级**的，代替工作区钩子去读项目里的声明文件 —— 于是「项目说了算」重新成立。
由于它是用户级的，它能在任何项目里生效，但只在**该项目存在配置文件时**才介入。

## 与全局 `guard-bash.js` 的关系

**并存、不替代。** 分工：

| | 用户级 `~/.zcode/hooks/guard-bash.js` | 本插件 |
|---|---|---|
| 范围 | 全局兜底，对所有项目一样 | 项目级增量，只在该项目生效 |
| 内容 | 灾难性命令黑名单（`rm -rf /`、fork bomb…） | 该项目的约定（用哪个包管理器、别写 `.env`…） |
| 载体 | 硬编码在脚本里 | `<repo>/.zcode/guardrails.json`，可随仓库进 git |

两者都挂在 `PreToolUse` 上。多方决策按 **`deny` > `ask` > 其它** 归并，
`additionalContext` 是累积的 —— 所以叠加不会互相干扰。

## 安装

在市场里 Install `project-guardrails` → **开新会话**。

然后在需要约束的项目里跑 `/guardrails init`，或手写 `.zcode/guardrails.json`。

## 规则文件

`<repo>/.zcode/guardrails.json`（**必须放在仓库根**，插件只读这一处）：

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
| `context[]` | 纯文本约定，会话开始时注入。**没有任何工具限制** |
| `rules[].tool` | 工具名，大小写不敏感。`*` 或省略 = 所有工具；也支持 `Bash\|Write` |
| `rules[].pattern` | 正则。默认忽略大小写，`"ignoreCase": false` 可关闭 |
| `rules[].action` | `deny`（拦截）或 `ask`（请求确认）。**其它值一律忽略** |
| `rules[].reason` | 拦截时展示的理由 |

**匹配的文本**：`Bash` 匹配 `command`；写文件类工具匹配 `file_path` 与内容字段；
都取不到时退化为整个 `tool_input` 的 JSON。单次匹配上限 20000 字符。

## 命令

| 命令 | 作用 |
|---|---|
| `/guardrails init` | 从 `AGENTS.md` / 近期提交里拟出约定，写入 `context`（`rules` 留空） |
| `/guardrails check` | 只校验不改：JSON 能否解析、每条 `pattern` 能否编译、`action` 是否合法 |
| `/guardrails <一段描述>` | 把它翻译成规则，**说明可能误伤什么并得到确认后**才写入 |

## 怎么验证它在工作

```bash
# 1. 会话顶部是否出现 [guardrails] 前缀（context 注入）
# 2. 在项目里试一条会被拦的命令，例如被规则禁止的包管理器
```

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

## 已知限制（未验证项，别当结论）

- **装好后没有在真实会话里跑过。** 35 项断言覆盖了各钩子的直调行为，
  但「ZCode 在真实工具调用前会调用本钩子」这一步没有实测证据。
- **这不是安全边界，是防手滑。** 删掉规则文件、或换个工具绕过正则，都能规避。
  密钥、权限之类的事不要指望它。
- **正则能力没有沙箱。** 复杂的用户正则可能很慢（ReDoS）；目前只做了
  「匹配文本截断到 20000 字符」这一层防护。
- **`PreToolUse` 上的进程启动开销是真实成本。** 一轮里几十次工具调用会累积成秒级延迟。
  这是省略 matcher 换来的通用性，用不用取决于你更在意哪一边。
