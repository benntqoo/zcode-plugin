# ZCode 能力缺口与可补足清单

> 生成：2026-10-04 · 作者：小满
> 目的：给本插件市场的**后续选题**提供依据 —— ZCode 哪里糙、哪些能用插件补、哪些补不了。
> 全部结论标注来源。`[源码]` = 反编译证据，`[官方]` = 官方 skill，`[实测]` = 本机跑出来的。

---

## 0. 结论先行

**ZCode 的系统提示管线本身不弱** —— 它有 12 个 section 组装器，身份、环境、Git、记忆、技能、
输出风格、会话指引都在里面。[源码]

**它弱在「可编程性」和「可移植性」**，具体三条：

1. **用户侧没有改系统提示的入口。** 唯一往模型上下文塞自定义文本的合法位置是 `AGENTS.md`
   （用户级 + 工作区级，静态顺序拼接）。没有模板、没有条件、没有分段开关。
2. **插件侧只有 5 类组件真能跑。** ZCode 自己的兼容性清单把插件字段分成三档，
   `agents` / `outputStyles` / `settings` 落在**「只记录、不执行」**那一档。[源码]
   ⇒ **用户说的「不像 WorkBuddy 有那么强的系统提示词能力」，根因就在这里**：不是提示词写得少，
   是**没有让插件往提示词里加东西的机制**。
3. **hook 只有 7 个事件，且工作区级 hooks 默认处于「待信任」。** 想靠钩子补，只能在很窄的窗口里做。[官方+源码]

⇒ 所以补足路线不是「写更好的提示词」，而是**用 hooks + commands + skills 把缺失的机制搭出来**。

---

## 1. 取证方法（可复现）

| 来源 | 位置 |
|---|---|
| 官方配置地图 | `~/.zcode/cli/plugins/cache/zcode-plugins-official/zcode-guide/0.3.0/skills/zcode-configuration-guide/SKILL.md` |
| **运行时契约（权威）** | `<ZCode 安装目录>/resources/glm/zcode.cjs` —— 14.8 MB 打包产物，含全部 zod schema |
| 兼容性清单 | 同上，搜 `compatibility:{runnable:` |
| 钩子输出 schema | 同上，搜 `hookSpecificOutput:grs` |
| 事件枚举 | 同上，搜 `Tl={SessionStart:` |
| 本机实测 | `~/.zcode/cli/config.json` / `log/*.jsonl` / `plugins/data/` |

> 反编译比查文档快，而且不会过时 —— 这个包就是 ZCode 当前版本的**实际行为**。

---

## 2. 现状：ZCode 的提示词管线其实有什么

`[源码]` 系统提示由这些组装器拼出来：

| 组装器 | 内容 |
|---|---|
| `buildIdentitySection` | 身份设定（"You are ZCode, an interactive coding agent"） |
| `buildEnvInfoSection` | 工作目录、平台、模型 |
| `buildGitSystemContextSection` | 分支、状态 |
| `buildDynamicBehaviorSection` | 行为规则（工具偏好、`file:line` 引用等） |
| `buildMemorySection` | 持久记忆（见 §3.5） |
| `buildSkillsSection` | 启用中 skill 的 name + description |
| `buildOutputStyleSection` | 输出风格 ← **机制存在** |
| `buildSessionGuidanceSection` | 会话级引导 |
| `buildSubagentContextSection` | 子代理上下文 |
| `buildRequestUserContextSection` | 用户上下文请求 |
| `buildWorkflow*Section`（4 个） | 工作流运行时 |

**结论**：管线完整。缺的不是「写提示词的能力」，是**「让外部往里塞内容的入口」**。

---

## 3. 硬缺口清单

### 3.1 ZCode 自己声明的兼容性分级 `[源码]`

```
runnable:       skills, commands, hooks, mcpServers, userConfig
diagnosticOnly: agents, lspServers, outputStyles, channels, settings
unsupported:    mcpb, dxt, npm, hostPattern, pathPattern
```

| 缺口 | 后果 | 能否用插件补 |
|---|---|---|
| 插件不能带 `agents` | 无法用插件分发子代理 | ⚠️ 只能落到用户/工作区级子代理目录，插件帮不上 |
| **插件不能带 `outputStyles`** | **无法用插件替换或追加系统提示风格** —— 这是「提示词能力弱」的**机制级**根因 | ❌ 补不了。只能用 `AGENTS.md` 模拟 |
| 插件不能带 `settings` | 无法随插件分发默认配置（如 `hooks.enabled`、权限规则） | ⚠️ 能用 SessionStart 钩子代写配置文件，但脏 |
| 插件不能带 `lspServers` | 无 LSP 集成 | ❌ |
| `unsupported` 五项 | `mcpb` / `dxt` / `npm` / `hostPattern` / `pathPattern` 全不支持 | ❌ 别在这些方向浪费设计 |

> ⚠️ 注意矛盾：官方 guide 写「插件贡献 skills, commands, hooks, MCP servers, **and agents**」，
> 但源码的兼容性清单把 `agents` 归为 `diagnosticOnly`。
> 另一个旁证：插件目录布局白名单里**有** `agents` 和 `output-styles` 两个子目录名 `[源码]`。
> ⇒ 目录会被识别/拷贝，但**不执行**。**结论：以源码清单为准，guide 那句话是过时的。**

### 3.2 hooks 表面太窄（只有 7 个事件）`[源码][官方]`

```
SessionStart · UserPromptSubmit · PreToolUse · PermissionRequest
PostToolUse · PostToolUseFailure · Stop
```

缺的（Claude Code 有、ZCode 没有）：

| 缺失事件 | 具体损失 |
|---|---|
| `PreCompact` | **压缩拦不住**，只能在 `SessionStart(source=compact)` 事后补刀 —— 这正是 skill-forge 现在的做法，属于曲线救国 |
| `SessionEnd` | 没有干净的收尾时机；只能用 `Stop`，而 `Stop` 要靠 `decision:block` 让模型多跑一轮 = 烧 token、用户要等 |
| `SubagentStop` | 子代理行为完全不受控 |
| `Notification` | 无法对接外部通知 |

### 3.3 工作区级 hooks **默认待信任** —— 项目自带约束的门槛高 `[官方][源码]`

| 资源 | 工作区级的待遇 |
|---|---|
| MCP servers | **自动信任、自动连接**（官方原文：workspace-scoped servers are trusted and auto-connected） |
| **Hooks** | **默认待信任**：需显式信任才执行（`trustState: pending_trust`），`trusted_persistent` 可持久；`bundleDigest` / `hookDeclarationDigest` 一变即 `stale_digest` 失效。**不是「策略禁止执行」** |
| Skills / commands | 会加载，但**被用户级同名遮蔽** |
| AGENTS.md | 会加载，且**后注入**（能覆盖用户级）—— 唯一「项目说了算」的通道 |

> ⚠️ **2026-10-05 更正**：本节原写「**一条都不执行**（安全策略）/ fail-closed」，**是错的**。
> 源码 `IQs()` 给项目 hook 挂的是 `admission → evaluateDispatch()`，而配置/插件 hook 直接派发
> （`TQs()`）。差别很实际：前者**能做**，只是要逐仓库信任、改一次声明就重来；后者免这道闸。

⇒ 后果：**项目自带行为约束的门槛高**。想给某个项目加「守卫」，要么逐仓库解决信任问题，
要么只能靠 `AGENTS.md` / skills —— 后者管不住工具调用。
⇒ 这是**最大的可补足面**，也是本仓库最值得做的方向。

### 3.4 用户级优先于工作区级（skills / commands）`[官方]`

与直觉相反：**同名时全局那份胜出**，项目级被静默遮蔽。症状极隐蔽 —— **文件在，改了不起作用**。

⇒ 机制级问题，**补不了**。只能靠命名约定规避。

### 3.5 记忆闭环缺一环 `[源码][实测]`

- ZCode **有**内建记忆：落点 `<cliStorageRoot>/memories/projects/<projectOrUser>-<hash16>/memory`
  （本机 `~/.zcode/cli/memories/` 存在）；写入由一个 **memory extraction subagent** 完成（源码里有它的提示词）。
- 开关：`features.memory.enabled`，**默认 `false`**。
- 但**没有消费者/管理器**：本机 `~/.zcode/hooks/memory-candidates.jsonl` 已有 **275 条 / 250 KB**
  （2026-08-05 → 10-03），只有生产者 `stop-memory.js` 写它，**全盘搜索没有第二个引用者**。
  那是用户自建钩子，ZCode 原生记忆根本不读它。

⇒ **可补足。** 跟 skill-forge 是同族问题：**时机 + 去重 + 生效**，只是对象从 skill 换成 memory。

### 3.6 skill 预算不可观测

每轮注入所有**启用中** skill 的 `name` + description（约 250 字符截断），总量有固定预算；
超预算后注入退化成「只有名字」，自动触发率骤降。**但没有任何界面或命令告诉你用了多少。**

⇒ **可补足，且成本最低。** 读各个 skill root 算字符数即可，不需要钩子。

### 3.7 插件的运维坑（不是能力缺口，但会咬人）`[实测]`

| 坑 | 事实 |
|---|---|
| 本地目录市场不感知文件变化 | 改了内容必须 bump `version`，**且两处同步**（`marketplace.json` + `plugin.json`） |
| hook 配置是会话启动时快照 | 改完必须**开新会话**，不热加载 |
| **重装会清空插件数据目录** | 实测 1.1.0 → 1.1.2 后 `nudge-state.json` 消失。那里的状态必须能从零重建 |
| 「装好了」≠「生效了」 | 比对 `installedAt` 与最近一次 `plugins.completed` 的 `timestamp`。日志 mtime 不可信 |

---

## 4. 真正可补足的清单（按性价比排序）

评分：难度 / 价值 均为高·中·低。

| # | 缺什么 | 怎么补 | 用到什么 | 难度 | 价值 |
|---|---|---|---|---|---|
| 1 | **skill 预算不可观测** | 命令 `/skill-budget`：扫所有 skill root，统计每个 `description` 字符数、按 root 分组求和、查同名遮蔽、报超预算与重复面 | command + skill（**无需 hook**） | 低 | **高** |
| 2 | **记忆闭环无消费者** | 消费 `memory-candidates.jsonl`：去重 → 聚类 → 写 ZCode 原生 memory 或沉淀成 skill。用**异步钩子**做，不占用户一轮 | hook(`Stop`, `async`) + command | 中 | **高** |
| 3 | **项目级约束无处安放**（工作区 hooks **默认待信任**，逐仓库开闸门槛高） | 一个用户级钩子，`SessionStart` 读 `<repo>/AGENTS.md` + `<repo>/.zcode/skills` 做自检并提示；配 `/project-rules` 命令管理 | hook + command | 中 | **高** |
| 4 | **权限策略不可移植** | `PermissionRequest` 钩子可以 `behavior:"allow"` + `permissionUpdates:[{type:"addRules",...}]` —— **用插件分发允许清单**，比手工配 rules 可移植得多 | hook(`PermissionRequest`) | 中 | **高**（被低估）|
| 5 | **压缩不可拦截** | 用 `PostToolUse` / `Stop` 增量维护一份「会话要点」文件，在 `SessionStart(compact)` 时回灌。取代不了 `PreCompact`，但能减轻压缩损失 | hook ×2 | 中 | 中 |
| 6 | **子代理不能随插件分发** | 用 command + Task 工具模拟编排；把定义落到**用户级**子代理目录（插件里放不了） | command + skill | 中 | 中 |
| 7 | **插件不能带默认配置**（`settings` 不执行） | `SessionStart` 首次运行时补写 `~/.zcode/cli/config.json` 的缺失键（含 `hooks.enabled`）。要幂等、要备份 | hook(`SessionStart`) | 中 | 低 |

### 补不了的（别浪费设计）

| 东西 | 原因 |
|---|---|
| 用插件替换系统提示 / 自定义输出风格 | `outputStyles` 是 `diagnosticOnly` —— 机制级不支持 |
| 让项目覆盖个人偏好（同名 skill） | 用户级优先是硬编码规则 |
| 让工作区 hooks **免信任**自动生效 | `IQs()` 给项目 hook 挂 `admission → evaluateDispatch()`，`trustState` 默认 `pending_trust`，且摘要一变即 `stale_digest`。要「零配置、随仓库走」只能绕：用户级插件读仓库里的声明文件（`project-guardrails` 的做法） |
| LSP 集成、`mcpb` / `dxt` 包 | `lspServers` 不执行；三类包 `unsupported` |

---

## 5. 建议下一步

1. **先做 #1（`/skill-budget`）** —— 不需要钩子、不需要改配置、可独立验证，而且解决的是
   一个**当前正在发生的**问题（skill 库无上限增长，撞预算后自动触发率骤降）。
2. **再做 #4（权限策略包）** —— 能力最被低估的一条，`PermissionRequest` 能直接改权限规则集，
   可移植性收益明确。
3. **#2 / #3 需要先定口径**：#2 要先决定「记忆写进 ZCode 原生 memory 还是写成 skill」
   （两者职责重叠，见 HANDOFF 第七节）；#3 要先决定「项目约束放 AGENTS.md 还是 skill」。
   **口径没定就动手，必然返工。**

---

## 附录：未验证项（别当结论用）

- `agent` / hook 入口 schema 里有 **`async: boolean`** 字段 `[源码]`，
  但**异步钩子的语义未验证** —— 能不能注入上下文、出错怎么处理，都没测。
  §4 的 #2 依赖它，动手前先做最小实验。
- `hookSpecificOutput` 的完整联合类型只提取到三个分支（`PreToolUse` / `PermissionRequest` / `Stop`），
  `SessionStart`、`UserPromptSubmit`、`PostToolUse` 各自允许哪些字段**未逐条确认**。
- 「description 约 250 字符截断」这个数值来自 `~/.zcode/AGENTS.md` 的口径，**未在源码中复核**。
