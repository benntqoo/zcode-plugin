# zcode-plugin

个人 **ZCode 插件市场**仓库（marketplace id: `zcode-plugin`）。仓库根本身就是市场源 —— ZCode 的「Add marketplace → 本地目录」指向这个目录。

- 当前收录：**1** 个插件 —— [`skill-forge`](plugins/skill-forge/README.md)
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

`skill-forge` 的完整交接笔记（设计决策、审计记录、未验证项）见根目录 [`HANDOFF.md`](HANDOFF.md)。

## 仓库结构

```
zcode-plugin/                          ← 市场源根目录
├── marketplace.json                   市场清单（plugins[].source 指向插件目录）
├── README.md                          本文件 —— 市场级说明与插件开发约定
├── HANDOFF.md                         跨会话交接笔记（当前主要是 skill-forge）
├── .gitignore
└── plugins/
    └── skill-forge/                   插件本体
        ├── .zcode-plugin/plugin.json  插件清单
        ├── README.md                  该插件的安装 / 验证 / 回滚说明
        ├── commands/                  /skill-forge、/skill-audit
        └── hooks/                     hooks.json + 钩子脚本 + 自带的 lib/
```

约定：**插件专属文档放 `plugins/<name>/README.md`**；市场级约定与跨插件事项写在本文件。

## 新增一个插件

1. 建目录 `plugins/<kebab-case-name>/`
2. 写 `plugins/<name>/.zcode-plugin/plugin.json` —— 最小只需 `name`；
   可选组件字段：`version`、`commands`、`skills`、`hooks`、`mcpServers`、`agents`
3. 做内容：`commands/*.md`、`hooks/hooks.json` + 脚本、`skills/<x>/SKILL.md`
4. 在根 `marketplace.json` 的 `plugins[]` 追加一条：

   ```json
   { "name": "<name>", "version": "1.0.0", "description": "...",
     "source": "./plugins/<name>", "category": "productivity" }
   ```

   **两处版本号要一起动**：`marketplace.json` 的 `plugins[].version` 与插件自己的 `plugin.json` 的 `version`
5. 本地自测 → commit → GUI 里对该插件执行更新/重装 → **开新会话**验证

命名约束：插件 `name` 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`。

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
