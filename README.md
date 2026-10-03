# zcode-plugin

个人 **ZCode 插件市场**仓库（marketplace id: `zcode-plugin`）。仓库根本身就是市场源 —— ZCode 的「Add marketplace → 本地目录」指向这个目录。

- 当前收录：**3** 个插件
  - [`skill-forge`](plugins/skill-forge/README.md) —— 多步任务后沉淀可复用 skill
  - [`memory-loop`](plugins/memory-loop/README.md) —— 闭合记忆回路：候选分流 → 蒸馏 → 会话注入
  - [`project-guardrails`](plugins/project-guardrails/README.md) —— 补齐「工作区 hooks 不执行」留下的项目级约束缺口
- 远端：`git@github.com:benntqoo/zcode-plugin.git`（`main`）

## 安装

1. ZCode → **Settings → Plugins** → 右上 **Create → Add marketplace** → 选本地目录：

   ```
   D:\Code\zcode-plugin
   ```

2. 在市场里对目标插件点 **Install**（新建插件默认启用）
3. **开新会话** —— hook 配置在会话启动时快照，运行中的会话不会热加载

## 已收录插件

| 插件 | 版本 | 作用 | 文档 |
|---|---|---|---|
| `skill-forge` | 1.1.2 | 多步任务后自动沉淀可复用 skill，并在使用中顺手修正已有 skill（2 个命令 + Stop/SessionStart 钩子） | [plugins/skill-forge/README.md](plugins/skill-forge/README.md) |
| `memory-loop` | 1.0.0 | 消费上游 `stop-memory.js` 产出的记忆候选：Stop 按 cwd 分流到各项目并去重，SessionStart 把蒸馏后的 `MEMORY.md` 注入上下文。1 个命令 + 2 个钩子 | [plugins/memory-loop/README.md](plugins/memory-loop/README.md) |
| `project-guardrails` | 1.0.0 | 项目级约束：读 `<repo>/.zcode/guardrails.json`，SessionStart 注入约定、PreToolUse 执行工具规则。补的是「ZCode 不执行工作区级 hooks」这个缺口。1 个命令 + 2 个钩子 | [plugins/project-guardrails/README.md](plugins/project-guardrails/README.md) |

`memory-loop` 是「下游」性质的插件 —— 它假设上游已有某个钩子在写记忆候选（默认对接
`~/.zcode/hooks/memory-candidates.jsonl`）。没有上游时它不会报错，只是什么也不做。

`project-guardrails` 是**补充**而非替代：用户级的 `~/.zcode/hooks/guard-bash.js` 依旧是全局兜底黑名单，
本插件只叠加**项目级增量规则**。两者在 `PreToolUse` 上共存 —— 多方决策按 `deny > ask > 其它` 归并。

两份插件的完整设计笔记见根目录 [`HANDOFF.md`](HANDOFF.md)。

## 这些插件增强的是 ZCode 的「机制」，不是「提示词」

**结论先行**：ZCode 的系统提示管线本身不弱 —— 它有 12 个 section 组装器（身份、环境、Git、
记忆、技能、会话指引都在里面）。弱的是**可编程性与可移植性**：没有让外部往上下文塞内容的入口，
也没有让项目自带约束的通道。本仓库的插件全部在补这三条机制。

| ZCode 原生 | 后果 | 补足插件 | 补足手段 | 生效入口 |
|---|---|---|---|---|
| 记忆候选只写不读 | `memory-candidates.jsonl` 只增不减，全盘无消费者；原生记忆 `features.memory.enabled` 默认 `false` | `memory-loop` | 按 `cwd` 分流到各项目 → 手动蒸馏 → 会话开始注入 | `SessionStart` → `additionalContext` |
| 工作区级 hooks **不执行** | 项目无法自带行为约束；`AGENTS.md` 只能写静态文字，管不住工具调用 | `project-guardrails` | 项目内写 `.zcode/guardrails.json`，由**用户级**插件代为执行 | `SessionStart` 注入约定 + `PreToolUse` 返回 `deny`/`ask` |
| 经验不沉淀、skill 库无观测 | 踩过的坑下次重踩；description 撞预算后自动触发率骤降 | `skill-forge` | 任务收尾把经验写进 `<repo>/.zcode/skills/`，`/skill-audit` 盘点预算 | `Stop` + `SessionStart` + 2 个命令 |

### 由此推出的使用须知（使用者视角）

1. **唯一能往上下文塞自定义文本的窗口是 `SessionStart`**（以及静态的 `AGENTS.md`）。
   `UserPromptSubmit` 每轮都跑，拿它注入同一份内容只是重复烧上下文预算。
2. **唯一能拦住工具调用的窗口是 `PreToolUse` / `PermissionRequest`**，其余 5 个事件只能注入文本。
3. **每次改配置或重装插件，都要开新会话** —— hook 配置在会话启动时快照，运行中的会话不会热加载。
4. 本仓库插件的数据都落在**项目内**（`<repo>/.zcode/`），可 review、可进 git。
   唯一例外是各插件的**机械游标**（放插件数据目录，重装会被清空 —— 这是设计允许的，丢了只需重扫）。

### 补不了的三件（别在这上面花设计）

| 想要 | 为什么不行 |
|---|---|
| 用插件替换 / 追加系统提示，或自定义输出风格 | `outputStyles` 属 `diagnosticOnly` —— 只记录、不执行 |
| 让项目覆盖个人偏好（同名 skill / command） | 用户级优先于工作区级是硬编码规则，不是配置项 |
| 用插件分发子代理、LSP、默认配置 | `agents`、`lspServers`、`settings` 同样不执行 |

> 依据与取证命令见 [`docs/analysis/zcode-capability-gaps.md`](docs/analysis/zcode-capability-gaps.md)。

## 仓库结构

```
zcode-plugin/                          ← 市场源根目录
├── marketplace.json                   市场清单（plugins[].source 指向插件目录）
├── README.md                          本文件 —— 市场级说明与插件开发约定
├── HANDOFF.md                         跨会话交接笔记
├── .gitignore
├── docs/
│   └── analysis/
│       └── zcode-capability-gaps.md   ZCode 能力缺口分析 + 插件可补足清单（选题依据）
└── plugins/
    ├── skill-forge/                   插件本体
    │   ├── .zcode-plugin/plugin.json  插件清单
    │   ├── README.md                  该插件的安装 / 验证 / 回滚说明
    │   ├── commands/                  /skill-forge、/skill-audit
    │   └── hooks/                     hooks.json + 钩子脚本 + 自带的 lib/
    ├── memory-loop/
    │   ├── commands/                  /memory-loop
    │   └── hooks/                     ingest-candidates.mjs（Stop）+ recall-memory.mjs（SessionStart）
    └── project-guardrails/
        ├── commands/                  /guardrails
        └── hooks/                     session-rules.mjs + pretooluse-guard.mjs
```

> 钩子脚本一律用 **`.mjs`** 后缀。插件目录里没有 `package.json`，`.`js` 能否被当成 ESM
> 取决于 Node ≥ 22.7 的模块自动探测 —— `.mjs` 是显式的，不依赖 Node 版本。

约定：**插件专属文档放 `plugins/<name>/README.md`**；市场级约定与跨插件事项写在本文件。

## 新增一个插件

1. 建目录 `plugins/<kebab-case-name>/`
2. 写 `plugins/<name>/.zcode-plugin/plugin.json` —— 最小只需 `name`。
   **真正能跑的组件只有 5 类**：`commands`、`skills`、`hooks`、`mcpServers`、`userConfig`。
   `agents` / `outputStyles` / `settings` / `lspServers` 属于 `diagnosticOnly` —— 写进去会被识别、被记录，
   但**不执行**（详见下方能力缺口文档）
3. 做内容：`commands/*.md`、`hooks/hooks.json` + 脚本、`skills/<x>/SKILL.md`
4. 在根 `marketplace.json` 的 `plugins[]` 追加一条：

   ```json
   { "name": "<name>", "version": "1.0.0", "description": "...",
     "source": "./plugins/<name>", "category": "productivity" }
   ```

   **两处版本号要一起动**：`marketplace.json` 的 `plugins[].version` 与插件自己的 `plugin.json` 的 `version`
5. 本地自测 → commit → GUI 里对该插件执行更新/重装 → **开新会话**验证

命名约束：插件 `name` 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`。

> **动笔前先读** [`docs/analysis/zcode-capability-gaps.md`](docs/analysis/zcode-capability-gaps.md) ——
> ZCode 的插件兼容性清单把字段分成 `runnable` / `diagnosticOnly` / `unsupported` 三档，
> 其中 `agents`、`outputStyles`、`settings`、`lspServers` **只记录不执行**。
> 也就是**插件无法分发子代理、无法自定义系统提示/输出风格、无法带默认配置**。
> 那份文档还列了 7 个 hook 事件之外的空白（无 `PreCompact`/`SessionEnd`/`SubagentStop`）
> 和一份按性价比排序的可做选题清单。

## 开发硬规矩（实测踩过的坑，别重复）

### 清单与结构

- `marketplace.json` 放**仓库根**、插件放 `plugins/` 下 —— 均已实测可用
- 插件清单目录首选 `.zcode-plugin/`，`.claude-plugin/`、`.codex-plugin/` 也认

### hooks.json

- 用 `"type": "process"` + **args 数组**，不要 `"type": "command"` 拼 shell 引号 —— Windows 上会炸
- **字段不能混用**：`process` 只认 `command` / `args` / `timeoutMs` / `statusMessage`；
  `timeout`（秒）属于 `command` 类型。写错字段 → 整条钩子被**静默丢弃**
- `matcher` 是**大小写敏感正则**。写错 = 永不匹配，且没有任何报错
- 引用插件自身资源用 `${ZCODE_PLUGIN_ROOT}`；插件**自带** `lib/`，
  不要 import 用户级 `~/.zcode/hooks/lib/`（用户改自己的库会把插件搞坏）
- 支持的 7 个事件：`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PermissionRequest` /
  `PostToolUse` / `PostToolUseFailure` / `Stop`

### 钩子输出

- 严格 schema：**多一个 key 整个输出作废**
- 合法顶层 key 只有：`additionalContext` / `continue` / `decision` / `hookSpecificOutput` /
  `reason` / `stopReason` / `suppressOutput`
- 注入上下文 → `{ hookSpecificOutput: { hookEventName, additionalContext } }`
- Stop 拦截并让模型继续 → `{ decision: "block", reason }`
- **放行 → 空输出 + exit 0**，不要显式写 allow（会覆盖其他钩子的决策）
- stdin payload 是 **snake_case 与 camelCase 双写**，取值两种都要试
  （`hook_event_name` / `hookEventName`；`cwd`、`session_id`、`stop_hook_active`、`last_assistant_message` 都拿得到）
- **插件全局生效**：一套钩子在所有工作区跑，钩子里**不能写死路径**，一律从 payload 的 `cwd` 现算

#### `hookSpecificOutput` 是 7 个分支，字段不能跨事件混用

源码里是 `discriminatedUnion("hookEventName", ...)`，**恰好每个事件一个分支**：

| 事件 | 该分支允许的字段 |
|---|---|
| `PreToolUse` | `additionalContext?` + **`permissionDecision?: "allow"\|"ask"\|"deny"`** + `permissionDecisionReason?` + `updatedInput?` |
| `PermissionRequest` | **`decision?`** —— `{ behavior:"allow", permissionUpdates:[{ type:"addRules", … }] }` 可直接改写权限规则集 |
| `Stop` / `SessionStart` / `UserPromptSubmit` / `PostToolUse` / `PostToolUseFailure` | **只有 `additionalContext?`** |

⇒ **能影响工具调用的只有 `PreToolUse` 和 `PermissionRequest`**。其余 5 个事件只能注入文本，别指望它们拦东西。
⇒ `hookEventName` 与当前事件不一致会直接抛错。

#### 多个钩子挂在同一事件上会怎样

| 字段 | 合并方式 |
|---|---|
| `additionalContext` | **累积（push 进数组），不覆盖** —— 多个钩子各注入一段，全都生效 |
| `permissionDecision` | **后者覆盖前者**，最终归并规则是 **`deny` > `ask` > 其它** |

⇒ 推论：一个钩子「没意见」时必须发**空输出**，不能显式发 `allow` —— 那会把别人的 `deny` 冲掉。

#### `async: true` 的真实语义（容易被误解）

```js
executionMode: type === "command" && async === true ? "background" : "foreground"
```

- **只对 `type: "command"` 生效**；`type: "process"` 的 schema 里根本没有这个字段
- 语义是**丢到后台执行**（fire-and-forget），**不是**「延后注入上下文」
- 适合**纯副作用**钩子（写文件 / 上报），不占用户那一轮
- 要注入上下文就必须 `foreground`

> 本项目实测：一次前台钩子的总开销约 **85 ms**（node 启动占大头）。
> 所以 `PreToolUse` 上挂全量 matcher 是**要付代价**的 —— 钩子里的第一件事应该是
> 「配置文件不存在就立刻退出」这种快速路径。

#### 钩子进程能拿到的环境变量

`ZCODE_PLUGIN_ROOT`（插件安装目录）/ `ZCODE_PLUGIN_DATA`（数据目录，**重装会清空**）/
`ZCODE_PROJECT_DIR`（＝payload 的 `cwd`）/ `ZCODE_SESSION_ID` / `ZCODE_PLUGIN_ID` /
`ZCODE_STORAGE_DIR` / `ZCODE_SKILL_DIR` / `ZCODE_APP_VERSION`（`CLAUDE_*` 双写）。
`hooks.json` 的 `command` / `args` 里可写 `${ZCODE_PLUGIN_ROOT}` 做替换，
但 `${ZCODE_SESSION_ID}` 在**声明期**替换会抛错，只能在运行时从 env 读。

### 生效机制

| 项 | 行为 |
|---|---|
| 本地目录市场 | **不感知文件变化** —— 改了插件内容必须 bump `version`，否则 ZCode 不认为有更新 |
| hook 配置 | **会话启动时快照**，不热加载 —— 改完必须开新会话 |
| 工作区级 hooks | **不执行**（ZCode 安全策略）—— 只有配置文件与插件里的 hook 会跑 |
| 安装缓存 | `~/.zcode/cli/plugins/cache/<marketplace-id>/<plugin>/<version>/` |
| 市场缓存 | `~/.zcode/cli/plugins/marketplaces/<id>/` 是仓库的**副本**（自带 `.git`），不是软链 |
| 插件数据目录 | `~/.zcode/cli/plugins/data/<name>@<marketplace>/`，钩子内由环境变量 `ZCODE_PLUGIN_DATA` 给出（回退 `CLAUDE_PLUGIN_DATA`）。**别落 tmpdir** —— 会被系统清 |
| **重装会清空插件数据目录** | 实测 1.1.0 → 1.1.2 后原本存在的 `nudge-state.json` 消失、目录被重建。⇒ 存在这里的状态**必须能从零重建**，不能当持久存储 |
| 安装记录 | `~/.zcode/cli/plugins/installed_plugins.json`（`version` / `installPath` / `installedAt` / `scope`） |
| 启用状态 | `~/.zcode/cli/config.json` → `plugins.enabledPlugins` |
| 设置页 | 插件的 hooks **只读** —— 不能单独开关某一条，只能整体启用 / 停用插件 |

### 「配置了不生效」排查顺序

1. 同名遮蔽？（skill / command 是**用户级优先于工作区级**，不是项目覆盖全局）
2. 没开新会话？（hooks 是快照）
3. 没 bump version？（本地市场不感知变化）
4. 是工作区级 hooks？（安全策略，根本不执行）
5. 先读启动日志确认注册数 —— `hookCount` 是 `0` 就别再查脚本逻辑了，问题在清单 / 启用态

```bash
grep "bootstrap.app.startup.plugins.completed" ~/.zcode/cli/log/zcode-$(date +%F).jsonl | tail -1
```

| 日志字段 | 含义 |
|---|---|
| `hookCount` | 全局注册到的钩子数（装插件前 `0` → 装后变成插件钩子数） |
| `commandRootCount` | 命令根数 |
| `enabledPluginCount` / `pluginCount` | 启用数 / 发现数 |
| `skillRootCount` | skill **根**数，不是条目数 —— 别拿它对账 skill 数量 |

再交叉验证两件事：

```bash
# 已装的就是当前源码？
diff -r plugins/<name> ~/.zcode/cli/plugins/cache/<mkt>/<name>/<ver>
# 钩子真跑过？（有状态文件 = 进程真起来过，不是只注册）
ls ~/.zcode/cli/plugins/data/<name>@<mkt>/
```

### 「装好了」≠「生效了」

重装只换磁盘上的文件，**不会**换正在跑的会话里的钩子。用时间戳分辨：

```bash
# 重装时刻
grep -o '"installedAt":"[^"]*"' ~/.zcode/cli/plugins/installed_plugins.json
# 最近一次会话启动（＝插件被载入的时刻）
grep "bootstrap.app.startup.plugins.completed" ~/.zcode/cli/log/zcode-$(date +%F).jsonl | tail -1 | grep -o '"timestamp":"[^"]*"'
```

**后者早于前者 ⇒ 没有任何会话载入过新版本**，当前会话还在跑旧快照 —— 此时别去查脚本逻辑，去**开新会话 / 重启应用**。

日志文件 mtime 是「现在」**不能**证明有会话启动 —— 会话进行中一直在写日志，认 `timestamp` 不认 mtime。

### 权威文档在哪

ZCode **自带**官方 skill，比在线文档全 —— 先读它，别猜：

```
~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/<最高版本>/skills/
├── zcode-configuration-guide/SKILL.md                        路径 / 作用域 / 优先级 / 合并规则
└── diagnosing-{skills,commands,hooks,plugins,mcp}/SKILL.md   分项排查手册
```

文档站注意单复数：`/docs/skill`、`/docs/plugin`、`/docs/hooks`（复数 `skills` 是 404）。

文档没写清的运行时契约（环境变量名、字段名），去应用包里翻**官方插件自己的实现**：

```
<ZCode 安装目录>/resources/glm/packages/<官方插件>/dist/**/*.js
```

## 许可证

**MIT** —— 见根目录 [`LICENSE`](LICENSE)（`Copyright (c) 2026 Jrtou`）。

`marketplace.json` 的 `owner.name` 与各插件的 `plugin.json` `author.name` 同为 `Jrtou`，保持一致。
