# 贡献指南（CONTRIBUTING）

本文件覆盖：如何新增插件 / 技能、hooks 开发的实测规矩、「配置了不生效」的排查手册。
阅读顺序建议：先读 [`docs/analysis/zcode-capability-gaps.md`](docs/analysis/zcode-capability-gaps.md)
（ZCode 插件兼容性三档清单），再动笔。

> 约定：**插件专属文档放 `plugins/<name>/README.md`；技能自身的说明放 `skills/<name>/`**；
> 开发库级约定写根 README；技能安装与目录约定写 [`skills/README.md`](skills/README.md)。

## 仓库结构

```
zcode-plugin/                          ← 市场源根目录
├── marketplace.json                   市场清单（plugins[].source 指向插件目录）
├── README.md / README.en.md           项目说明（中 / 英）
├── CONTRIBUTING.md                    本文件
├── HANDOFF.md                         跨会话交接笔记
├── docs/
│   ├── analysis/zcode-capability-gaps.md   ZCode 能力缺口分析（选题依据）
│   └── archive/                       账本冷层投影
├── plugins/                           插件源（每目录一个可安装插件）
│   └── <name>/
│       ├── .zcode-plugin/plugin.json  插件清单
│       ├── README.md                  该插件的安装 / 验证 / 回滚说明
│       ├── commands/                  斜杠命令（每条一个 .md）
│       ├── hooks/                     hooks.json + 钩子脚本（+ 自带 lib/）
│       └── skills/<name>/SKILL.md     插件分发的技能（单层目录）
└── skills/                            技能源（独立于插件，手动安装到用户级技能根）
    └── <name>/
        ├── SKILL.md                   协议 / 方法正文
        ├── assets/                    可执行件（如体量闸脚本）
        └── references/                长内容（模板、实证）
```

> 钩子脚本一律用 **`.mjs`** 后缀。插件目录里没有 `package.json`，`.js` 能否被当成 ESM
> 取决于 Node ≥ 22.7 的模块自动探测 —— `.mjs` 是显式的，不依赖 Node 版本。

## 新增一个插件

1. 建目录 `plugins/<kebab-case-name>/`
2. 写 `plugins/<name>/.zcode-plugin/plugin.json` —— 最小只需 `name`。
   **真正能跑的组件只有 5 类**：`commands`、`skills`、`hooks`、`mcpServers`、`userConfig`。
   `agents` / `outputStyles` / `settings` / `lspServers` 属于 `diagnosticOnly` —— 写进去会被识别、被记录，
   但**不执行**（详见能力缺口文档）
3. 做内容：`commands/*.md`、`hooks/hooks.json` + 脚本、`skills/<x>/SKILL.md`
4. 在根 `marketplace.json` 的 `plugins[]` 追加一条：

   ```json
   { "name": "<name>", "version": "1.0.0", "description": "...",
     "source": "./plugins/<name>", "category": "productivity" }
   ```

   **版本号三处一起动**：插件的 `plugin.json`、根 `marketplace.json` 的 `plugins[].version`、
   根 README 的版本表。更新检测口径 = marketplace 条目 version vs 已装 plugin.json version ——
   不 bump 版本，ZCode 不认为有更新，改动永远到不了安装态。
5. 本地自测 → commit → GUI 里对该插件执行更新/重装 → **开新会话**验证

命名约束：插件 `name` 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`；命令文件名（去 `.md`）必须匹配
`^[a-z0-9][a-z0-9_:-]{0,63}$`；SKILL.md 的 `description` **超过 1024 字符整条技能被丢弃**（非截断）。

## 新增一个技能

技能与插件的关键差别：**技能没有市场通道** —— 不进 `marketplace.json`，装法是手动落盘。

1. 建目录 `skills/<kebab-case-name>/`，写 `skills/<name>/SKILL.md`：

   ```markdown
   ---
   name: <name>
   description: 做什么 + MUST USE 当：<触发条件，写具体场景与关键词>
   ---
   ```

2. 长内容放 `skills/<name>/references/`（模板、实证、长文档），`SKILL.md` 保持可扫读
3. 需要打包成插件分发时（要 hooks / commands / 走市场）→ 挪到 `plugins/<name>/skills/<name>/`，
   按上一节的插件流程走（插件内技能只认 `skills/<名>/SKILL.md` **单层目录**）
4. 安装到用户级技能根并开新会话：

   ```bash
   cp -r skills/<name> ~/.agents/skills/<name>     # 或 ln -s "$(pwd)/skills/<name>" ~/.agents/skills/<name>
   ```

`description` 是**唯一触发依据** —— 别只写「一个关于 X 的技能」。
> ⚠️ 用户级与项目级**同名**时用户级胜出（各技能根带 `priority`，升序取首个匹配）——
> 分发技能时注意别撞仓库内已有的同名技能。

## hooks 开发硬规矩（实测踩过的坑，别重复）

### 清单与结构

- `marketplace.json` 放**仓库根**、插件放 `plugins/` 下 —— 均已实测可用
- 插件清单目录首选 `.zcode-plugin/`，`.claude-plugin/`、`.codex-plugin/` 也认
- `hooks/hooks.json` 是**标准位置，自动加载** —— manifest 里不要再声明 `hooks` 字段指向它
  （重复声明会产生重复诊断；只有放非标准位置才需要声明）

### hooks.json

- 用 `"type": "process"` + **args 数组**，不要 `"type": "command"` 拼 shell 引号 —— Windows 上会炸
- **字段不能混用**：`process` 只认 `command` / `args` / `timeoutMs` / `statusMessage`；
  `timeout`（秒）属于 `command` 类型。写错字段 → 整条钩子被**静默丢弃**
- `matcher` 是**大小写敏感正则**。写错 = 永不匹配，且没有任何报错。
  SessionStart 的 source 当前只有 `startup` / `clear` / `compact`
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
- **插件全局生效**：一套钩子在所有工作区跑，钩子里**不能写死路径**，一律从 payload 的 `cwd` 现算

#### `hookSpecificOutput` 是 7 个分支，字段不能跨事件混用

源码里是 `discriminatedUnion("hookEventName", ...)`，**恰好每个事件一个分支**：

| 事件 | 该分支允许的字段 |
|---|---|
| `PreToolUse` | `additionalContext?` + **`permissionDecision?: "allow"\|"ask"\|"deny"`** + `permissionDecisionReason?` + `updatedInput?` |
| `PermissionRequest` | **`decision?`** —— `{ behavior:"allow", permissionUpdates:[{ type:"addRules", … }] }` 可直接改写权限规则集 |
| `Stop` / `SessionStart` / `UserPromptSubmit` / `PostToolUse` / `PostToolUseFailure` | **只有 `additionalContext?`** |

⇒ **能影响工具调用的只有 `PreToolUse` 和 `PermissionRequest`**。其余 5 个事件只能注入文本。
⇒ `hookEventName` 与当前事件不一致会直接抛错。

#### 多个钩子挂在同一事件上

| 字段 | 合并方式 |
|---|---|
| `additionalContext` | **累积（push 进数组），不覆盖** |
| `permissionDecision` | **后者覆盖前者**，最终归并 **`deny` > `ask` > 其它** |

⇒ 一个钩子「没意见」时必须发**空输出**，不能显式发 `allow` —— 那会把别人的 `deny` 冲掉。

#### `async: true` 的真实语义

只对 `type: "command"` 生效；语义是**后台 fire-and-forget**，不是「延后注入上下文」。
适合纯副作用钩子（写文件 / 上报）；要注入上下文就必须前台。
本项目实测：一次前台钩子总开销约 **85 ms**（node 启动占大头）—— `PreToolUse` 上挂全量 matcher
是要付代价的，钩子第一件事应该是「配置不存在就立刻退出」的快速路径。

#### 钩子进程能拿到的环境变量

`ZCODE_PLUGIN_ROOT`（插件安装目录）/ `ZCODE_PLUGIN_DATA`（数据目录，**重装会清空**）/
`ZCODE_PROJECT_DIR`（＝payload 的 `cwd`）/ `ZCODE_SESSION_ID` / `ZCODE_PLUGIN_ID` /
`ZCODE_STORAGE_DIR` / `ZCODE_SKILL_DIR` / `ZCODE_APP_VERSION`（`CLAUDE_*` 双写）。
`hooks.json` 的 `command` / `args` 里可写 `${ZCODE_PLUGIN_ROOT}` 做替换，
但 `${ZCODE_SESSION_ID}` 在**声明期**替换会抛错，只能在运行时从 env 读。
长期数据写 `ZCODE_PLUGIN_DATA`，**别写回安装目录、别落 tmpdir**。

### 生效机制

| 项 | 行为 |
|---|---|
| 本地目录市场 | **不感知文件变化** —— 改了插件内容必须 bump `version` |
| hook 配置 | **会话启动时快照**，不热加载 —— 改完必须开新会话 |
| 工作区级 hooks | **默认「待信任」**（`trustState: pending_trust`）；插件与用户级配置的 hook 直接派发、无此闸 |
| 安装缓存 | `~/.zcode/cli/plugins/cache/<marketplace-id>/<plugin>/<version>/` |
| 市场缓存 | `~/.zcode/cli/plugins/marketplaces/<id>/` 是仓库的**副本**（自带 `.git`），不是软链 |
| 插件数据目录 | `~/.zcode/cli/plugins/data/<name>@<marketplace>/`（env `ZCODE_PLUGIN_DATA`）。**重装会清空** —— 孻的状态必须能从零重建 |
| 安装记录 | `~/.zcode/cli/plugins/installed_plugins.json` |
| 启用状态 | `~/.zcode/cli/config.json` → `plugins.enabledPlugins` |
| 设置页 | 插件的 hooks **只读** —— 只能整体启用 / 停用插件 |

### 「配置了不生效」排查顺序

1. 同名遮蔽？（skill / command 是**用户级优先于工作区级**）
2. 没开新会话？（hooks 是快照）
3. 没 bump version？（本地市场不感知变化）
4. 是工作区级 hooks 还在**待信任**？
5. 先读启动日志确认注册数 —— `hookCount` 是 `0` 就别再查脚本逻辑了：

```bash
grep "bootstrap.app.startup.plugins.completed" ~/.zcode/cli/log/zcode-$(date +%F).jsonl | tail -1
```

再交叉验证：

```bash
# 已装的就是当前源码？
diff -r plugins/<name> ~/.zcode/cli/plugins/cache/<mkt>/<name>/<ver>
# 钩子真跑过？（有状态文件 = 进程真起来过）
ls ~/.zcode/cli/plugins/data/<name>@<mkt>/
```

**「装好了」≠「生效了」** —— 重装不换正在跑的会话里的钩子。比对「重装时刻」与
「最近一次会话启动时间戳」，后者早于前者 ⇒ 开新会话。日志认 `timestamp` 不认 mtime。

### 权威文档在哪

ZCode **自带**官方 skill，比在线文档全 —— 先读它：

```
~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/<最高版本>/skills/
├── zcode-configuration-guide/SKILL.md                        路径 / 作用域 / 优先级 / 合并规则
└── diagnosing-{skills,commands,hooks,plugins,mcp}/SKILL.md   分项排查手册
```

在线文档注意单复数：`/docs/skill`、`/docs/plugin`、`/docs/hooks`（复数 `skills` 是 404）。
官方插件源码位置：`<ZCode 安装目录>/resources/glm/packages/<官方插件>/dist/**/*.js`。
