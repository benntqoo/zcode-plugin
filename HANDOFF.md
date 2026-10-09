# HANDOFF — zcode-plugin 市场

> 更新：2026-10-04 05:50
> 状态：仓库定位已扩为「**插件 + 技能开发库**」—— `plugins/` 3 个插件、`skills/` 1 个技能。
> `skill-forge` 已装 1.1.2 并已生效；**`memory-loop` 与 `project-guardrails` 为新建（各 1.0.0），尚未安装到 ZCode**。
> 新会话直接从这里接。
>
> 第一 ~ 十节是 `skill-forge` 的交接笔记；新插件见「十一」；`skills/` 目录与 doc-protocol 见「十二」
> （**二次整合为一份自包含技能见「十二.6」**）。

**最新变更（2026-10-04）**：

- **v1.1.0**：skill 落点从全局库 `~/.zcode/skills/` 改为**当前项目**的 `<repo>/.zcode/skills/`，
  新增 `hooks/lib/project.js` 做路径解析。详见「八、落点为何是项目级」。
- **v1.1.1**：一次「已装已用」状态审计后的修补（4 项），详见「九、v1.1.1 改了什么」。
- **v1.1.2**：仓库身份统一为 `Jrtou` + 补 `LICENSE`，详见「十、v1.1.2 改了什么」。
- **新增两个插件**：`memory-loop`（记忆闭环消费者）与 `project-guardrails`（项目级约束），
  各 1.0.0。详见「十一」。

---

## 一、这个项目是什么

`D:\Code\zcode-plugin` 是一个 **ZCode 本地插件市场仓库**，里面打包了一个插件 `skill-forge`。

它要做的事：**让 ZCode 的 agent 在多步任务后自动把可复用的做法沉淀成 skill，并在用的时候顺手修好已有的 skill。**

对应 WorkBuddy 那套「任务完成 → 提炼 skill → 下次会话生效 → 用中发现即改」的闭环。

### 为什么需要它

- ZCode 自带 `$. skills` 系统 —— **存储和加载通道齐全**，缺的是「驱动器」
- 官方 `skill-creator` 插件是纯 skill，**零 hook**，不会提醒 agent「该沉淀了」
- 所以本插件补的是**时机**（hooks），不是**方法**（skill-creator 已覆盖方法）

---

## 二、仓库结构

```
D:\Code\zcode-plugin\                   ← ZCode「Add marketplace」指向这里
├── marketplace.json                    市场清单（plugins[0].source = "./plugins/skill-forge"）
├── HANDOFF.md                          本文件
└── plugins\skill-forge\
    ├── .zcode-plugin\plugin.json       插件清单（name/version/commands/hooks）
    ├── README.md                       安装与验证说明
    ├── commands\
    │   ├── skill-forge.md              /skill-forge
    │   └── skill-audit.md              /skill-audit
    └── hooks\
        ├── hooks.json                  SessionStart(compact|clear) + Stop
        ├── session-skill-rules.js      压缩后重新注入三铁律
        ├── stop-skill-nudge.js         兜底推一次
        └── lib\
            ├── io.js                   自带的 hook I/O 库
            └── project.js              解析项目级落点（含 home 保护）
```

---

## 三、已完成

| 项 | 状态 |
|---|---|
| 插件包 10 个文件 | ✅ 已生成并迁移到 `D:\Code\zcode-plugin` |
| git 仓库 | ✅ 远端 `git@github.com:benntqoo/zcode-plugin.git`（main） |
| GUI 安装 | ✅ 市场已注册、插件已启用（实测确认） |
| **落点改项目级** | ✅ v1.1.0 —— 6 处路径全改 + 新增 `hooks/lib/project.js` |
| **v1.1.1 四项修补** | ✅ 源码已改（io.js / project.js / stop-skill-nudge.js / skill-forge.md），待重装 |
| **v1.1.2 身份统一 + LICENSE** | ✅ 已改（marketplace.json / plugin.json / 根 README / LICENSE），待重装 |
| **「已装已用」状态审计** | ✅ 2026-10-04 —— 见「九」 |
| 语法检查（4 个 js） | ✅ `node --check` 全过 |
| 冒烟测试 | ✅ 9 组场景全过（见下） |
| `~/.zcode/AGENTS.md` | ✅ 三铁律已加，落点已改为项目级 |
| AGENTS.md 备份 | ✅ `~/.zcode/AGENTS.md.bak-20261003` |
| 旧路径清理 | ✅ `~/.zcode/plugin-workspace/` 已空 |

### 冒烟测试实测记录

| 用例 | 期望 | 实测 |
|---|---|---|
| 完成动作+经验信号+具体路径 | 触发 `{"decision":"block",...}` | ✅ |
| 回复里已出现 `SKILL.md` | 放行（空输出） | ✅ |
| `stop_hook_active: true` | 放行（防递归） | ✅ |
| 同 session 第二次 | 放行（节流） | ✅ |
| `SessionStart/compact` | 注入三铁律 | ✅ |
| 状态文件记账 | `{"pt1":1,"pt4":1,...}` | ✅ |
| **T1** cwd=git 项目 | 触发，路径指向 `<repo>/.zcode/skills/` | ✅ |
| **T2** cwd=home | 放行（全局库保护生效） | ✅ |
| **T3** SessionStart cwd=git 项目 | 注入文本含项目路径 | ✅ |
| **T4** cwd=子目录 | 向上解析到仓库根 | ✅ |
| **T5** cwd=home 下裸目录 | 放行（保守，见下） | ✅ |
| **T6** cwd 缺失 | 回退 `process.cwd()`，不崩 | ✅ |

`resolveSkillTarget()` 全场景实测：

| cwd | 判定 | 落点 |
|---|---|---|
| `D:/Code/zcode-plugin` | OK | `D:/Code/zcode-plugin/.zcode/skills` |
| `D:/Code/zcode-plugin/plugins/skill-forge` | OK | 同上（向上找到仓库根） |
| `D:/Code/SideProject/Lumi` | OK | `D:/Code/SideProject/Lumi/.zcode/skills` |
| `C:/Users/Ben` | **SKIP** | 落点与全局库重合 |
| `C:/Users/Ben/SomeBareDir` | **SKIP** | 向上命中 home 的 `.zcode`，判为全局 |
| `C:/Users/Ben/.zcode` | **SKIP** | 同上 |

> ⚠️ T5 是**有意的保守行为**：home 下没 `.git` 也没自有 `.zcode` 的裸目录会被判成 home 级而不推。
> 想在那里沉淀，`git init` 或建一个 `.zcode/` 即可（`findProjectRoot` 就近优先，会先命中它）。

> ⚠️ 踩过的坑：测试消息若短于 **80 字符**会被 `trim().length < 80` 拦掉，看起来像「没触发」。
> 复测时用完整长度的消息（实测 285 字节可用）。

---

## 四、待办

1. ~~添加市场~~ ✅ 已完成（`known_marketplaces.json` 里有 `zcode-plugin`，源 `D:\Code\zcode-plugin`）
2. ~~安装插件~~ ✅ 已完成（`cli/config.json` → `"skill-forge@zcode-plugin": true`）

3. ~~**重装到 v1.1.0**~~ ✅ **已完成（2026-10-04 核对）**
   实测：`installed_plugins.json` → `version: "1.1.0"`；安装缓存与仓库源码 `diff -r` **零差异**；
   市场缓存副本 `~/.zcode/cli/plugins/marketplaces/zcode-plugin/` 亦一致。
   启动日志 `bootstrap.app.startup.plugins.completed` 给出 `hookCount: 0 → 2`、
   `commandRootCount: 0 → 1`（装插件前后对比）—— 钩子确实挂上了。

4. ~~**重装到 v1.1.2**~~ ✅ **已完成（2026-10-04 04:06 核对）**
   实测：`installed_plugins.json` → `version: "1.1.2"`，`installPath` 指向 `…/cache/zcode-plugin/skill-forge/1.1.2`；
   旧版本目录已清空（只剩 `1.1.2`）。仓库源码 vs 安装缓存 `diff -r` **零差异**；
   vs 市场缓存副本 `~/.zcode/cli/plugins/marketplaces/zcode-plugin/plugins/skill-forge/` 亦**零差异**。
   `config.json` 的 `enabledPlugins` 仍为 `true`。
   ⚠️ 副作用：**重装会清空插件数据目录** —— 原来那个 `nudge-state.json` 已消失、目录被重建。
   ⇒ 这里的任何状态都必须能从零重建，不能当持久存储。（已记入根 `README.md` 与技能库）

5. **开新会话验证** ← **当前唯一待办**
   ⚠️ **此刻还没生效**：重装于 `2026-10-03T20:06:12Z`，而日志里最近一次
   `bootstrap.app.startup.plugins.completed` 是 `2026-10-03T17:14:22Z`（＝ 01:14 CST，重装前）。
   两者之间没有任何会话启动 ⇒ **当前会话仍在跑 v1.1.0 的钩子快照**。
   hooks 在会话启动时快照、不热加载 —— 必须**开新会话或重启应用**才切到 1.1.2。
   （别拿日志 mtime 判断：本会话一直在写日志，mtime 是「现在」；只认 `timestamp`。）
   ZCode 在会话启动时快照 hook 配置，**不热加载**。
   - 打 `/` 应看到 `skill-forge`、`skill-audit`
   - 跑一个会踩坑的多步任务 → 看回复末尾写的是 **`<当前项目>/.zcode/skills/`** 而非 `~/.zcode/skills/`

---

## 五、未验证 / 存疑（别当结论用）

| 项 | 说明 |
|---|---|
| ~~`marketplace.json` 的位置~~ | ✅ **已验证**（2026-10-04）：放仓库根即可，市场成功添加 |
| ~~`plugins/` 子目录约定~~ | ✅ **已验证**：插件从 `plugins/skill-forge/` 成功安装并启用 |
| `ZCODE_PLUGIN_ROOT` 变量替换 | 插件能跑说明替换生效（**间接**验证）；展开后的具体路径**未直接观测** |
| 原 `io.js:113` 的 `emitContinue` | 用 legacy 的 `{continue:true, stopReason}` 格式，官方推荐 `{decision:"block", reason}`。**本插件绕开了它**（自带 io.js），原有那个没改、没测 |

---

## 六、设计决策（别改回去）

1. **SessionStart 只匹配 `compact|clear`，不含 `startup`**
   正常启动靠 AGENTS.md 注入规则；再注入一遍是白烧 token。只有压缩后才补刀。

2. **Stop 钩子最多每 session 推 1 次**
   `decision:block` 会让模型多跑一整轮、用户要等。WorkBuddy 的静默沉淀在 ZCode 做不到，所以只兜底不主攻。

3. **三道闸顺序不能动**
   `stop_hook_active` → 已提 SKILL.md → 信号三连（完成+经验+路径）→ 节流。任何一道去掉都会导致刷屏或死循环。

4. **`type: "process"` + args 数组，不用 `type: "command"`**
   ponytail 用 shell 引号包路径，Windows 上有风险。官方推荐 `process`。

5. **插件自带 `hooks/lib/io.js`，不 import 用户级**
   插件不该依赖 `~/.zcode/hooks/lib/`，否则用户改自己的 lib 会把插件搞坏。

---

## 七、遗留问题（与本插件相关但未处理）

- **272 条 `memory-candidates.jsonl` 积压未消化**
  路径 `~/.zcode/hooks/memory-candidates.jsonl`，横跨 2026-08-05 → 10-03。
  `stop-memory.js` 只写不消费。本插件只管新账（skill），没管旧账（memory 候选）。
  建议：先抽样 20 条看质量，再决定是否聚合成 skill，**别直接删**。

- ~~**是否 git init**~~ **已完成（2026-10-04）**
  已初始化为 git 仓库，默认分支 `main`，远端 `git@github.com:benntqoo/zcode-plugin.git`。
  首个提交 `b9a99f1`，本地与远端一致。含 `.gitignore`（排除 `node_modules`、`_c*.mjs` 等测试残留）。

- **ZCode 原生 Project Memory 开关**
  `Settings → General → Memory`，默认关闭。与本机制职责重叠且**不可浏览/不可清除**。建议二选一。

---

## 八、落点为何是项目级（v1.1.0 变更）

**变更动机**：v1.0.0 一律写 `~/.zcode/skills/`（全局库）。头头要求 skill 归属项目，不污染全局。

### 事实依据（ZCode 官方 `zcode-configuration-guide` v0.3.0）

| 作用域 | Skills 路径 |
|---|---|
| 用户级 | `~/.zcode/skills/`、`~/.agents/skills/` |
| 工作区级 | `<repo>/.zcode/skills/`、`<repo>/.agents/skills/` |

扫描顺序（早的优先）：explicit roots → 用户 `.zcode` → 用户 `.agents` → **工作区 `.zcode`（从 cwd 向上到仓库根，每层都算）** → 工作区 `.agents` → 插件。
同级内 `.zcode` 先于 `.agents`；**越深的目录越优先**。

### 三条反直觉规则（都会咬人）

1. **用户级优先于工作区级** —— 「first same-named skill wins (**user scope has priority**)」。
   全局库里有同名 skill，项目级那份**被静默遮蔽**，症状隐蔽（文件在、改了不起作用）。
2. **逐层向上扫描** —— 子目录里也可能有自己的 `.zcode/skills/`，且优先级更高。
3. **插件全局生效** —— 一套钩子在所有工作区跑，所以路径**必须**按 `cwd` 现算，写死必错。

### 实现

- 新增 `hooks/lib/project.js` → `resolveSkillTarget(cwd)`
  - `findProjectRoot()`：从 cwd 向上找**最近的** `.git` 或 `.zcode`（同等权重，先撞上谁算谁），
    都没有则回退 cwd（最多向上 40 层）。v1.1.1 前是「`.git` 绝对优先」，会让高位的 `.git`
    越过低位自带的 `.zcode`，算出的落点与 ZCode 实际读取的位置不一致 —— 已改为就近优先。
  - 返回 `{ root, skillsDir, isUserLevel }`
- `isUserLevel = true` 的两种情况：`root` 就是 home，或解析出的 `skillsDir` 与 `~/.zcode/skills` 路径重合
  → **Stop 钩子直接放行**，SessionStart 退回用户级路径
  → 这条是**必需的**：cwd=home 时「项目级 `.zcode/skills`」字面上就等于全局库，不挡就会打着「项目专属」的旗号写全局
- 两个钩子都改成从 payload 的 `cwd` 现算（该字段存在，已由 `stop-memory.js:33`、`session-context.js:25` 印证）

### 规则与产物的作用域是分开的（有意）

| | 位置 | 作用域 |
|---|---|---|
| 三条铁律（规则） | `~/.zcode/AGENTS.md` | 所有工作区 —— 每个项目都具备沉淀能力 |
| 产出的 SKILL.md | `<repo>/.zcode/skills/<name>/` | 只有当前项目 |

头头选的组合是「规则全局、落点项目」，不是「全都项目级」。

---

## 九、v1.1.1 改了什么（2026-10-04 审计后）

审计范围：插件源码、安装缓存、市场缓存、启动日志、真实产出（stock-agent 的两个 skill）。
**结论：无 P0 缺陷** —— 线上 v1.1.0 一直正常工作。以下 4 项是审计中发现的真实问题。

| # | 问题 | 证据 | 改法 |
|---|---|---|---|
| 1 | `/skill-forge` 用相对路径 `ls .zcode/skills/` | 从子目录触发时会打印「本项目还没有 skill 目录」，把模型推向**新建重复 skill**，正好撞上同文件「已有覆盖就改不要新建」 | 改成 `git rev-parse --show-toplevel` 后列 `$ROOT/.zcode/skills/` |
| 2 | frontmatter 白名单三处不一致 | `AGENTS.md` 与 `session-skill-rules.js` 列 5 字段，`stop-skill-nudge.js` 只列 4（漏 `license`） | 补齐 `license` |
| 3 | `nudge-state.json` 只增不减 | key = session_id，无上限，每次 Stop 全量读+写 | 保留最近 200 个会话，写入前剪枝 |
| 4 | `process.stdout.write` 后立刻 `process.exit(0)` | Windows 管道写是异步的，理论可截断（实测 5 次全 898 字节完整，**未复现**） | 换 `fs.writeSync(1, json)` |

另两处清理：`project.js` 的死字段 `relPath` 已删；`findProjectRoot` 的注释与实现对齐（见「八」）。

### 审计中已验证为真的事实（可复用）

- **怎么证明插件真生效**（别翻设置页）：

  ```bash
  grep "bootstrap.app.startup.plugins.completed" ~/.zcode/cli/log/zcode-$(date +%F).jsonl | tail -1
  ```

  `hookCount` 是全局钩子注册数（装前 0 → 装后 2）；`commandRootCount` 同理。
  `skillRootCount` 是**根**数不是条目数，别拿它对账 skill 数量。
- 插件数据目录：`~/.zcode/cli/plugins/data/skill-forge@zcode-plugin/`（钩子内由环境变量给出，
  实测 `ZCODE_PLUGIN_DATA` 可用）。真实触发过一次：`nudge-state.json` = `{"sess_5256dc5c-…":1}`。
- 安装记录：`~/.zcode/cli/plugins/installed_plugins.json`（version / installPath / scope）。
- 市场缓存 `marketplaces/<id>/` 是仓库的**副本**（自带 `.git`），不是软链。
- 4 个 js `node --check` 全过；钩子实测耗时 435ms（timeout 8000ms）。
- 落点解析 9 个 cwd 场景全对（home 保护 / 子目录上溯 / UNC / 不存在的路径）。
- 产出合规：stock-agent 两个 skill 的 `description` 分别 146 / 163 字符，
  字段为 `name/description/when_to_use/metadata`。

### 未验证 / 待确认

- **Stop 上挂着两个钩子**：用户级 `~/.zcode/hooks/stop-memory.js` 输出 `additionalContext`，
  本插件输出 `decision:block`。官方文档没说多钩子的输出如何合并。**未做对照实验** ——
  想确认就临时停掉一个，各跑一次对比。

### 相邻发现（不是本插件，但同一个 Stop 事件）

`~/.zcode/hooks/memory-candidates.jsonl`：**275 条 / 249 KB**（2026-08-05 → 10-03）。
全盘搜索只有生产者 `stop-memory.js` 引用它自己 —— **没有消费者**，每次 Stop 都在 append。
按项目分：stock-agent 238、Lumi 19。建议先抽样 20 条看质量再决定，**别直接删**。

---

## 十、v1.1.2 改了什么（2026-10-04）

仓库身份统一 + 补许可证文件。**无功能性改动**，钩子逻辑一个字没动。

| # | 项 | 改前 | 改后 |
|---|---|---|---|
| 1 | 根 `LICENSE` | **不存在**（`plugin.json` 却已声明 MIT —— 声明不生效） | 新增 MIT 全文，`Copyright (c) 2026 Jrtou` |
| 2 | `marketplace.json` → `owner.name` | `Ben` | `Jrtou` |
| 3 | `plugins/skill-forge/.zcode-plugin/plugin.json` → `author.name` | `Ben` | `Jrtou` |
| 4 | 版本号 | `1.1.1`（两处） | `1.1.2`（两处同步） |
| 5 | 根 `README.md` | 只说明「声明了 MIT 但没有 LICENSE」 | 指向 `LICENSE`，删掉待定项 |

**为什么 bump 而不是静默改**：`plugin.json` 在插件目录内，改了它就是改了插件内容。
虽然本次是从 1.1.0 跨版本重装、不 bump 也会被复制，但按仓库自己的规矩
（见根 `README.md`「新增一个插件」第 4 步）内容变了就该有版本号 —— 避免留下
「同一个 1.1.1 有两份不同内容」的历史。

署名口径：**统一用 `Jrtou`**（git 提交者 `Jrtou <benntqoo@gmail.com>`），不再混用 `Ben`。

---

## 十一、memory-loop 与 project-guardrails（2026-10-04 新建）

来自 `docs/analysis/zcode-capability-gaps.md` §4 选题清单里头头选中的 #2 / #3。
动手前先做了一轮**源码级前置验证**，结果推翻了那份文档附录里的两条「未验证」。

### 前置验证结论（已改写进根 README 与技能库）

| 项 | 结论 |
|---|---|
| `async: true` 语义 | 源码 `E0n()`：`executionMode: type==="command" && async===!0 ? "background" : "foreground"`。⇒ **只对 `type:"command"` 生效，语义是「丢到后台执行」，不是「延后注入上下文」**；`process` 型根本没有这个字段 |
| 多钩子合并 | 源码 `_Qs()`：`additionalContext` 是 **`push` 累积、不覆盖**；`permissionDecision` 覆盖式，最终归并 `deny > ask > 其它`。**（原文档标「未验证」，现已确认）** |
| `hookSpecificOutput` | 实为 **7 个分支、每事件一个**；能影响工具调用的**只有 `PreToolUse` 与 `PermissionRequest`**。**（原文档说「只确认 3 个」，是错的）** |
| 项目级配置 | `<repo>/.zcode/config.json` 支持 `plugins.options`，且 **workspace 覆盖 user**（与 MCP 的 user-over-workspace 方向相反） |
| 用户已有 4 个用户级钩子 | `guard-bash`(PreToolUse) / `session-context`(SessionStart) / `prompt-router`(UserPromptSubmit) / `stop-memory`(Stop)，注册在 `~/.zcode/cli/config.json`。⇒ **直接决定了两个新插件的定位** |

### 口径（头头选定的三条，均为推荐项）

1. **#2 记忆落点 = 项目内独立文件** `<repo>/.zcode/memory/MEMORY.md`，由 SessionStart 钩子注入。
   不写 `AGENTS.md`（会污染、膨胀不可控），也不写 ZCode 原生 memory（`features.memory.enabled`
   默认 false，且无消费者）。
2. **#3 与全局 `guard-bash` = 项目级增量规则**，全局那份保留兜底，两者并存。
3. **两个插件分开打包**，各自可独立启停。

### memory-loop（1.0.0）

补上记忆链路的**消费者** —— 上游 `stop-memory.js` 只写不读，已积压 276 条 / 256 KB。

| 文件 | 作用 |
|---|---|
| `hooks/ingest-candidates.mjs` | `Stop`。读源 jsonl 增量 → 按候选的 `cwd` 解析项目根 → 写 `<repo>/.zcode/memory/candidates.jsonl`，内容指纹去重。**纯副作用，不注入任何上下文** |
| `hooks/recall-memory.mjs` | `SessionStart`。注入 `MEMORY.md`（上限 4000 字符，超出截断）+ 一句未蒸馏提示 |
| `commands/memory-loop.md` | 手动蒸馏：读候选 → 判断值得留的 → 整理进 `MEMORY.md` → 推进游标 |

**关键设计：蒸馏故意不自动化。** 脚本判断不了「这条值不值得记」，把语义判断写死成启发式只会产噪音。
机械部分（分流 / 去重 / 注入）全自动，语义部分（蒸馏）由 `/memory-loop` 触发。

数据落点全在项目内（可 review、可进 git）：`candidates.jsonl` / `MEMORY.md` / `state.json`。
唯一的例外是消费游标 `ingest-state.json`，放插件数据目录 —— **重装会清空它，这是设计允许的**：
丢了只需重扫，项目侧的指纹去重会兜住。

### project-guardrails（1.1.1）

补的是：工作区级 hooks **默认处于「待信任」**（需逐仓库显式信任，`hookDeclarationDigest` 一变即
`stale_digest` 失效）⇒ 「项目自带约束」门槛高。用**用户级**插件（钩子直接派发）代理读取项目声明文件。
2026-10-05 起落点改**双路径**：`<repo>/.agents/guardrails.json` 优先（可入库），`.zcode/` 回退。
**同日起 `entrypoints` 改「约定优于配置」**：不写配置也生效（见下 §5-F4）。

| 文件 | 作用 |
|---|---|
| `hooks/session-rules.mjs` | `SessionStart`。注入 `context[]` |
| `hooks/session-entrypoints.mjs` | `SessionStart`（**第二个条目，独立失败域**）。注入 `entrypoints[]` —— 待办账本索引 + 体量状态 |
| `hooks/pretooluse-guard.mjs` | `PreToolUse`（**matcher 故意省略** = 全匹配）。按 `rules[]` 返回 deny / ask |
| `hooks/lib/entrypoints.mjs` | 账本/体量的解析与注入块构建（只读、fail-open、长度有上限）；含**内置约定集** `defaultSpecs` |
| `commands/guardrails.md` | `init` / `check` / 自然语言加规则 |
| `test/entrypoints.test.sh` | 直调验收 A/B 组（**37 条**）+ **A14 阈值合流**（hook 与 `check-doc-budget.py` 数值须相等） |

**关键设计：fail-open。** 配置读不到 / 坏了就放行 —— 它是用户自己写的项目配置，**不是安全边界**，
不能因为它写错就把会话卡死。坏正则逐条忽略，不影响同文件其它规则。
`PreToolUse` 省略 matcher 换来通用性，代价是每次工具调用一次进程启动 —— 所以脚本第一件事是
「没有规则文件就立刻退出」。

### 测试

`_probe.sh`（**纯 bash 驱动** —— 沙箱会拦脚本内部嵌套 spawn 子进程）→ **35 / 35 全过**：

- **ingest**：分流（含反斜杠 cwd 归一化）、游标增量、重复触发幂等、游标丢失后指纹去重兜底，
  以及非 Stop / `stop_hook_active` / home / 源文件缺失 四道闸门
- **recall**：无记忆不注入、正常注入、未蒸馏提示、蒸馏后不再提示、超长截断、home、错事件
- **guardrails**：无文件不介入、context 注入、deny / ask / 放行、`tool` 限定、非 Bash 工具匹配、
  camelCase payload、坏 JSON fail-open、只有 `context` 无 `rules`

耗时：前台钩子各约 **85 ms**（node 启动占大头），远低于 `timeoutMs`。

> 测试脚本自身踩过一次坑：断言用的 payload 文件在断言**之后**才创建，导致「空跑通过」。
> 已在 `run()` 里加了 payload / 钩子的存在性自检，缺文件直接判 FAIL。**同类问题以后要防。**

### 未验证（别当结论）

- **两个插件都没有在真实会话里跑过。** 全部证据来自对脚本的直接调用；
  「ZCode 真的会在每轮 Stop / 每次工具调用时调它们」这一步**没有实测**。
- `userConfig` 虽属 runnable 档，但**它的值以什么形式进入钩子进程未验证**（env 名？`${}` 替换？）。
  所以两个插件**都没用 userConfig**，改用环境变量 + 项目内约定文件，绕开这个未知。
- `PreToolUse` 全量 matcher 的**真实性能影响未测**（只有单次 85 ms 这个数字）。

### 待办

1. 在市场里 Install 这两个插件 → **开新会话**。
2. 装完读日志核对 `hookCount`（应先从 `2` 增加 —— 新增 4 个钩子条目；确切口径待实测）。
3. 首次实战观察：跑过一轮后，`<repo>/.zcode/memory/candidates.jsonl` 是否被创建。

## 十二、skills/ 与 doc-protocol（2026-10-04）

本仓库定位从「插件市场」扩为「**插件 + 技能的开发库**」，新增顶层 `skills/`（与 `plugins/` 平行）。

### 1. 为什么技能要单开一个目录

| | `plugins/` | `skills/` |
|---|---|---|
| 分发 | 走市场（`marketplace.json` 的 `plugins[]`） | **没有独立分发通道**，手动落盘 |
| 生效 | 安装插件 + 开新会话 | 落到技能根 + 开新会话或 `/clear` |

技能的单元只是 `SKILL.md`，硬塞进插件（`plugin.json` + hooks/commands）反而是包裹过重 ——
只有「需要 hooks/commands 一起分发」时才该做成插件。

### 2. doc-protocol：由两个技能合并为一个

来源两份（都不由本仓库维护，是**移植**来的）：

| 原位置 | 形态 |
|---|---|
| `~/.agents/skills/doc-truth-protocol/`（105 行） | 通用原则层 |
| `stock-agent/.agents/skills/doc-protocol/`（148 行 + evidence 116 行） | 项目专属路由 |

合并设计（用户 2026-10-04 裁定「通用层 + 项目覆盖档」）：

- **通用层** = `skills/doc-protocol/SKILL.md`（本仓库，通用原则，不预设文件名）
  + `references/evidence.md`（抽象后的失效模式 E1~E11）
  + `references/override-template.md`（覆盖档写法）
- **项目覆盖档** = `<repo>/.agents/doc-protocol.md`。命中则**以它为准**。
  stock-agent 的那份已就地转成覆盖档（`.agents/doc-protocol.md` + `-evidence.md`）。

### 3. 关键发现：为什么覆盖档不能做成「同名技能」

ZCode 解析 skill 根时，每个根带 `priority`（extraRoots=10 → 用户级 20/30 → 项目级 40/50+），
按 priority **升序**排序后取**首个**匹配（源码：`.sort((o,s)=>o.priority-s.priority)` + `loadSkill` 的 `find`）。

⇒ **用户级与项目级同名时，用户级遮蔽项目级。** 所以：

- 覆盖档**必须换文件名**（做普通 markdown），不能同名。
- 合并后的技能若在用户级叫 `doc-protocol`、而项目里也有同名技能 → 项目那份**永不生效**。

### 4. 覆盖档必须可入库

`stock-agent/.gitignore` 是 `.zcode/*`（只放行 `.zcode/skills/`）⇒ 放 `.zcode/` 的覆盖档
**不会随 git 分发**，换台机器协议失效。故约定查找顺序：

1. `<repo>/.agents/doc-protocol.md`（推荐 —— `.agents/` 一般入库）
2. `<repo>/.zcode/doc-protocol.md`（备用）

落盘前跑 `git check-ignore -v <路径>`。

### 5. 本次对仓库外做了什么（可回滚）

| 位置 | 动作 | 回滚方式 |
|---|---|---|
| `~/.agents/skills/doc-protocol/` | 新建（`cp -r` 自本仓库） | 删除该目录 |
| `~/.agents/skills/doc-truth-protocol/` | 删除（被合并版取代） | 备份在 `~/.agents/.backup/doc-truth-protocol-20261004/` |
| `stock-agent/.agents/skills/doc-protocol/` | `git rm -r`（内容搬入覆盖档） | `git checkout` 恢复 |
| `stock-agent/.agents/doc-protocol.md` 等 | 新增 | 删除 |
| `stock-agent/AGENTS.md` `:7`、`handoff.md:3` | 引用改指新路径 | `git checkout` |

**stock-agent 的改动未提交** —— 那个仓库有自己的 doc-protocol（handoff 段 + 追踪表），
按它的规矩该由头头在有上下文时提交，不该由本仓库代劳。

### 6. 二次整合：改为「一份自包含技能」（2026-10-04 晚）

头头裁定：**不做「通用层 + 项目覆盖档」两层**，改成**一份自包含技能**；
且**不要异动 stock-agent** —— 那个仓库的更新由他手动做。

| 件 | 变更 |
|---|---|
| `skills/doc-protocol/SKILL.md` | **重写**（213 行）：1~8 节通用原则不变，**新增第九节「落到具体仓库」**（三种承载方式 / 两条硬约束 / stock-agent 实例 / 自修订方式） |
| `skills/doc-protocol/references/stock-agent.md` | **新增**（79 行）：八层职责表 / 差异化落点 / 特有裁定（带日期） / E1~E11 实证 / 体量阈值 |
| `skills/doc-protocol/references/evidence.md` | 保留（103 行）；仅两处措辞：「项目覆盖档」→「落地档」并指向实例文件 |
| `skills/doc-protocol/references/override-template.md` | **删除** —— 内容已并入 SKILL.md 9.1 与实例文件 |
| `skills/README.md` / 根 `README.md` | 收录表、技能描述、目录树、遮蔽警告同步（警告改指 9.1） |

仓库外动作：

- 删除 `stock-agent/.agents/`（两个 md）；备份在
  `zcode-plugin/.workbuddy/backup/stock-agent-agents-20261004/`（`diff` 零差异）。
- **未动** `~/.agents/skills/doc-protocol/` —— 由头头手动替换。

> ✅ **悬空引用已修（2026-10-05，头头授权）** `stock-agent/AGENTS.md:7` 与 `handoff.md:3` 原指向已删的
> `.agents/doc-protocol.md`，现改指 `~/.agents/skills/doc-protocol/SKILL.md`（细则＝其 `references/stock-agent.md`）；
> 同时删去「项目覆盖档优先」的失效条款，并按审查建议给 `AGENTS.md:7` 补 **"at session start"**。
> **stock-agent 侧改动未提交**（该仓库有并发未提交改动，留给头头）。

本仓库改动已提交（`0b21349`）。

---

## 十三、「doc-protocol 整体做成插件？」取证 + entrypoints 任务单（2026-10-04 晚）

头头问：把 doc-protocol 整体形成一个插件是否更合适。**结论：不宜**——
插件换来的只有「确定性 hook」，却丢掉「热改 + 可移植」；而 doc-protocol 的正文是要反复改的东西。
⇒ 拆分：**正文留技能、只有需要确定性执行的部件才包插件**。

### 1. 技能 vs 插件（源码实测，逐条可复跑）

| 维度 | 技能 | 插件 |
|---|---|---|
| 生效 | **实时读**，`cp -r` 即改即用 | 两跳拷贝（仓库 → 市场快照 → `cache/<mkt>/<name>/<version>/`），**改仓库不生效** |
| 技能根优先级 | 用户级 `.zcode/skills`=10 / `.agents/skills`=20；项目级 30/40+ | **1000, 1010, …**（`Gzs=1000`、`Jzs=10`）⇒ 最低 |
| 命名 | 原名 | `pluginName:skillName`（`qualifiedName`；裸名仍可调，注入行后缀 `(also loadable as …)`） |
| 独有能力 | 无 | **hooks + commands**；插件 hook **直接派发、不过准入闸** |
| 可移植 | `.agents/` 是跨工具根 | 只在 `~/.zcode/cli/plugins/` 生效 ⇒ 绑死 ZCode |

（`discoverSkills` 按 **path** 去重，不是按 name ⇒ 同名两条都会进提示列表。）

### 2. 三条顺带发现（都比原问题更该先修）

| # | 发现 | 影响 |
|---|---|---|
| F1 | **`marketplace.json` 落后于仓库**：市场快照与 `known_marketplaces.json` 的 `pluginCount: 1` 只有 `skill-forge` | `memory-loop` / `project-guardrails` **从未可装**（不是"未安装"）。**先在 GUI 刷新市场** |
| F2 | **技能注入行被静默截断到 249 字**（`formatSkillLine(u, 250)`） | `doc-protocol` 的 description 实测 269 字 ⇒ 尾部「任何仓库，即使用户没提「文档」二字」被切掉。`when_to_use` 是合法 frontmatter 键但拼在 description **之后**一起截，救不了 ⇒ 只能压缩前置。**✅ 已修（2026-10-05）：压到 248 字，尾部完整保留；仓库源 + 安装态双处同步** |
| F3 | **🔴 更正旧断言**：「工作区级 hooks 不执行」**不准确** | 实为 `IQs()` 给项目 hook 挂 `admission → evaluateDispatch()`；`trustState` 含 `trusted_persistent`，默认 `pending_trust`，`bundleDigest`/`hookDeclarationDigest` 一变即 `stale_digest` 失效；另有 `blocked_policy`。**✅ 已修（2026-10-05）：全部旧措辞改为「默认待信任」；仅在「引述 + 声明其错误」的更正语境保留原句** |
| F4 | **🔴 `entrypoints` 违背开箱即用**（头头质疑「为什么需要手动添加 `.agents/guardrails.json`」） | 默认值**早已写在** `BUDGET_DEFAULTS` 里，却没有出口：`loadEntrypoints` 在配置缺失时直接 `return null` ⇒ 要求人把同样的约定**再抄一遍**成 `entrypoints[]` 才生效。那不算配置，算重复劳动。**✅ 已修（2026-10-05，v1.1.1）：加内置约定集 `defaultSpecs`（约定优于配置），并修掉它牵出的两个隐藏缺陷 —— 见 §5-F4 详情** |

### 3. 产出：`docs/plans/project-guardrails-entrypoints-task-2026-10-04.md`

补的正是 `docs/reviews/doc-protocol-design-review-2026-10-04.md` 的 **P0「接入层未达成」**：
技能按需调用、开场不加载 ⇒ 用一个 **`SessionStart` 钩子**把仓库待办账本**确定性**注进开场。

要点：`<repo>/{.agents,.zcode}/guardrails.json` 加 `entrypoints[]`（`file`/`from`/`statuses`/`maxRows`/`maxChars`；
落点双路径见下方 §5-G1）；
新增 `hooks/lib/entrypoints.mjs`（解析）+ `hooks/session-entrypoints.mjs`（注入），
`hooks.json` 追加**第二个** SessionStart 条目（独立失败域、`session-rules.mjs` 零回归）；
版本 → **1.1.0**（后并入 **1.1.1**，见 §5-F4）。注入块末句强制写「本块是索引，不是真值」——
否则违背 doc-protocol 的单一权威载体。

验收含 **A 组直调 + B 组反向变异（全红才算过）+ C 组端到端对照**
（只说「继续」→ 模型应主动点出 🔴 项；禁用插件再跑应答不出）。**1.1.1 后为 37 条全绿。**

**原阻塞项已解除（2026-10-05 取源）**：任务单曾要求「先做探针 dump 再写逻辑」，担心 SessionStart
触发源字段名未知。源码取证：`T0n(e)` 对 payload **全量 spread**（`{...e, agent_type:e.agentName, …}`
只**额外加** claude 风格别名，不做裁剪）⇒ `source` 等原始字段原样可读。更重要的是
**Part C 根本不需要按 `source` 分流**（`startup`/`resume` 之外未见其他 SessionStart 调用点；
且「任何会话开始都该注入账本」本身就是对的）⇒ 阻塞项不成立，直接实现。

### 4. 本仓库当前状态

`HANDOFF.md` 改（本节）；**未跟踪**：`docs/reviews/`、`docs/plans/`；与 `origin/main` 同步。

### 5. 二次核验（同日稍后）：任务单不够完善，补 G1/G2/G5

头头问「当前功能是否已经完善」。对任务单**逐条实测核验**（不采信自述）。**结论：未完善** —— 2 个实质缺口 + 1 个文档缺口。

**✅ 抽查通过的**（任务单 §1 声称的契约，全部复现）：`SessionStart`/`Stop` 的 `additionalContext` push 累积；
描述截断阈值 `eKs=250`；插件技能根 priority `1000/1010…`（`Gzs=1e3`、`Jzs=10`）；
§2 的 `from: "## 剩余未完成与遗留事项"` 前缀命中 `stock-agent/handoff.md:7`（账本区间 `:7~:66` = 59 行）。

> 取证陷阱：`grep 'Gzs=[0-9]{1,6}'` 把 `1e3` **截成 `1`**，一度误判「摘要记错」。minified 里数值可能是科学计数法。

**🔴 G1【结构级·致目标失效】配置落点被 `.gitignore` 吃掉**
`stock-agent/.gitignore:6` = `.zcode/*`，实测 `git check-ignore -v .zcode/guardrails.json` **命中** ⇒
配置**不入库** → 新 clone / 换机器即丢 → 与 doc-protocol 的「跨会话 / 跨 agent 接续」**直接冲突**。
**这是上一轮 doc-protocol 覆盖档踩过的同一个坑**（当时从 `.zcode/` 迁到 `.agents/`），任务单没吸收。
⇒ **头头拍板：改双路径读取** —— `RULES_RELS = [".agents/guardrails.json", ".zcode/guardrails.json"]`，
`.agents/` 优先（实测在 stock-agent **未被忽略**）、`.zcode/` 回退（零破坏）。
连带：`project.mjs:28` 的 `findProjectRoot` 标记集须加 `.agents`；路径逻辑抽 `readGuardrailsFile(root)` 只留一处。

**🔴 G2【执行级·按单执行必卡】任务单缺「创建配置」这一步**
`stock-agent/.zcode/` 实测只有 `plans/`、`skills/`，**无 `guardrails.json`**；而 §6-A1 断言该配置已存在 ⇒
照单执行完 A1 必然失败。已补 **§5 步骤 7**（由头头手动，不异动 stock-agent）。

**G5【文档级】旧错误断言未更正** —— `README.md:37` 与 `hooks/hooks.json:2` 仍在用；更正清单从 8 → **10 个文件**。

任务单已从 376 → **472 行**（新增 §2.0 落点、步骤 0 / 步骤 7、A12/A13 验收、U7/U8 未验证项）。
**仍未实现任何功能** —— 任务单状态仍是「待实施」。

---

## 十五、entrypoints 零配置化：F4 详情（2026-10-05，v1.1.0 → v1.1.1）

**触发**：头头质疑 —— 「为什么需要手动添加 `.agents/guardrails.json`，这样很不符合开箱即用的道理」。

**结论：质疑成立，是设计缺陷不是必然。**

### 根因

`hooks/lib/entrypoints.mjs` 的 `loadEntrypoints` 原本是：

```js
const found = readGuardrailsFile(root);
if (!found) return null;                 // ← 没有配置文件 → 直接放弃
if (!Array.isArray(raw) || !raw.length) return null;   // ← 有文件但没写 entrypoints → 也放弃
```

而**同一个文件的 `BUDGET_DEFAULTS` 已经把完整约定写好了**（`handoff.md`、`from: null`=首个二级标题、
`to: "^##\\s+\\d{4}-\\d{2}-\\d{2}"`）。⇒ 约定已编码，却没有出口：
要求人把它**重新抄一遍**成 `entrypoints[]` 才肯生效。那不算「配置」，算重复劳动。

**深层原因：耦合。** `entrypoints` 与 `context[]` / `rules[]` 挤在同一个文件里，后两者是**人的意图**
（不可推断，必须显式），于是 `entrypoints` 白白继承了「文件必须存在」这道闸。
而三者里真正「格式即约定」的只有 `entrypoints`。

### 顺带查出两个被耦合掩盖的缺陷

| # | 缺陷 | 后果 |
|---|---|---|
| ① | **`doc-budget.json` 单独放着等于没有** | `loadBudgetConfig` 只在 `buildBudgetBlock` 里被调用，而后者只在**已有 entrypoint spec** 时才被调 ⇒ 只放阈值文件、不写 `guardrails.json` 时 hook 读不到它。「阈值单一真源」的故事实际是**半断的** |
| ② | **`from: null` 两处语义不一致** | `buildBudgetBlock` 传了 `fromIsSecondLevelHeading: true`，`buildTableBlock` 没传 ⇒ 同一个 `from: null`，账本行按「首个二级标题」算、表格行却按「文件第 0 行」算。做默认集必然踩到 |

### 修法

| 改动 | 内容 |
|---|---|
| 新增 `defaultSpecs(root)` | 内置约定集 = `[handoff-ledger, budget]`。**不重复定义阈值** —— `file`/`from`/`to` 全部从 `loadBudgetConfig(root).ledger` 派生，避免开第二处真源（F2 的翻版） |
| `loadEntrypoints` 改三级裁定 | 数组（含 `[]`）→ 听配置；字段缺失 → 回退约定集；约定集也空 → `null` |
| 「没写」≠「写空」 | `entrypoints: []` = **明确关闭**；把空数组也当默认的话，用户就没有关掉它的办法 |
| 默认集**全有或全无** | gate 在「账本载体文件存在」。否则任何有 `AGENTS.md` 的仓库每会话都多一行体量摘要 —— 那是噪声 |
| 注入块声明来源 | 约定默认生成的块，末句追加「（内置约定；可用 guardrails.json 的 entrypoints[] 覆盖或关掉。）」，否则用户不知道块从哪来、怎么关 |
| 修缺陷 ② | `buildTableBlock` 改传 `{ fromIsSecondLevelHeading: !spec.from }` |

**为什么不给 `context[]` / `rules[]` 也做零配置**：前提不可推断，不是格式问题。
`context[]` 是人的项目约定（且 `AGENTS.md` 已被 ZCode 自己确定性注入，再注一遍是重复）；
`rules[]` 是人的 deny/ask 意图。猜不得。

### 验收

`test/entrypoints.test.sh` 30 → **37 条全绿**。新增 A15（零配置仍注入）/ A15b-d、A16（`[]` 关掉）、
A17（约定默认区间从首个二级标题起）、B5（删掉载体 → 默认集整体静默）。
A8 语义随之改写（「无配置」≠「无输出」了）。

**⚠️ 测试基建踩坑（已修）**：本环境把 `rm` / `mv` **shim 到 `cli/vendor/shim/safe-bin/`**，
非交互执行下会**间歇性挂住** —— 表现为「测试随机超时」，且因为间歇性会伪装成偶发。
已把测试里的删除 / 改名一律改走 node（`rmp` / `mvp` 两个 helper），绕开 shim。

---

## 十六、体量治理落地 + 两份规划合并（2026-10-05）

**背景**：`docs/reviews/doc-protocol-handoff-bloat-review-2026-10-05.md` 查出「协议治横向分裂、不治纵向膨胀」；
查外部最佳实践后产出 R1'~R8' 优化方案。本轮执行「A→C」把它落成可用的东西。

### 1. Part A —— 协议改动（已落盘）

`skills/doc-protocol/SKILL.md` **217 → 285 行**（description 仍 248 字，未动）：

| 改动 | 节 |
|---|---|
| 分类学**加「层」列**（热/温/冷）+ 三层定义与预算 | 一 |
| 指令文件**双预算**（≤60 KB / ≤150 条）+ 超限抽叙事 | 三 |
| 账本改**「未完成投影」不变量**（活表 `~~` == 0）+ 双预算（≤15 KB/40 行）+ 单行 ≤600 B | 四 |
| 归档线补**字节判据**（2000 行 或 500 KB）+ 冷层分片 ≤500 KB + 补记机械化 | 五 |
| 收尾加**第 0 步体量闸** + 第 7 步**陈旧即删**；账本对账改「投影」 | 七 |
| 红灯加 8（活账本出现 `~~`）、9（陈旧滞留） | 八 |

`references/evidence.md` 追加 **E12/E13/E14**；`references/stock-agent.md` 加 **2026-10-05 裁定** +
第五节换成**现行阈值表 + 双时点基线**（09-11 / 10-05）。

> **只压缩叙事与死行，绝不压缩规则**（外部分歧的裁定：规则/决策整块留热层）。

### 2. Part B —— 体量闸脚本（已写，随技能分发）

**新增** `skills/doc-protocol/assets/check-doc-budget.py`（随技能分发）。
输出结构化 JSON，**硬越线退出码 1**；覆盖 handoff 行/字节、AGENTS 字节/条数、活账本字节/行/死行、补记、归档片、段头格式。

**实测（对 stock-agent 只读）**：复现审查全部数字 —— handoff 2044 行/648,626 B、账本 91,355 B/42 行/**25 死行**/最长行 5,249 B、AGENTS 93,700 B/135 条 → exit **1**。
边界：空目录 → 0；缺失路径 → 0；`py_compile` 通过。
*（过程中修掉两处误报：段头用中文数字「第N段」、补记应只从段头取并按「第N段」归组。）*

### 3. Part C —— 两份规划合并（已落盘）

**新增** `docs/plans/doc-protocol-bloat-and-entrypoints-impl-2026-10-05.md` —— 合并版实施单。
- 原 `doc-protocol-bloat-control-optimized-2026-10-05.md` 与 `project-guardrails-entrypoints-task-2026-10-04.md`
  各加**墓碑**指向它（按 doc-protocol §一「已退役文档只留墓碑」），保留作时点证据。
- 合并的关键不是拼版，是**合流**：**check-doc-budget.py 的输出 = 收尾第 0 步的闸 + `entrypoints` 开场注入的数据源**（同一份预算，两处消费）。
- entrypoints 侧新增一条 `kind: "budget"` 的 entry；预算在 **hook（Node）里直接算**，不 shell 出去跑 Python。

### 4. 仓库状态

`README.md`（目录树加 `assets/`、技能描述补体量治理）、`skills/README.md`（落点加 `assets/`、description ≤250 提醒）已同步。
`docs/plans/`、`docs/reviews/` 仍**未跟踪**。**未提交。**

### 5. 待头头手动（两件）

1. **更新技能**：`cp -r skills/doc-protocol/. ~/.agents/skills/doc-protocol/`（description 未变，但正文/实证/assets 都改了）
2. **首次账本投影**（stock-agent 侧）：把 25 行死行移入 `docs/archive/handoff-ledger-2026-10.md` 并从活表删除 —— 一步把账本从 91 KB 降到约 1/5。

> **已取消**第三件「复制脚本到 `stock-agent/scripts/`」（2026-10-05 更正）：脚本**随技能分发**即到达安装态，
> 在仓库再放一份 = **双真源**（技能一改副本陈旧）。调用用技能安装态路径：
> `python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root .`
> 脚本的 `--root` / `--config` 已参数化 ⇒ **stock-agent 零文件即用**，仓库侧只放阈值配置（本仓库连配置都不需要）。
> 判据已写进 `SKILL.md` 9.1 第 3 条；唯一例外是「仓库有 CI / pre-commit 等独立于技能安装的消费方」。
> （旁注：`docs/reviews/doc-protocol-handoff-bloat-review-2026-10-05.md:172` 的 `scripts/` 表述是**审查时点口径**，
> 按协议时点文档不回改，以本条为准。）

### 6. 质量检查（2026-10-05 第二轮，对上述改动）

**通过**：`description` 248 字 ≤ 250 ✅ · 落点三处措辞一致（`SKILL.md` §七 / 9.1 第 3 条 / 9.2）✅ ·
**活文档零**「`scripts/check-doc-budget.py`」残留 ✅ · 命令实跑：`--root .` / `--root <abs>` / 空目录 → exit 1/1/0 ✅ ·
`py_compile` ✅ · `git check-ignore` 对 `scripts/`·`doc-budget.json`·`.agents/guardrails.json` 均无输出 ✅。

**发现并已修**：

- **F1（文档缺陷）**：`--config` 指向**不存在**的文件 → **exit 2 硬失败**，但 `SKILL.md` §七 / 脚本 docstring / 任务单 §3
  都把它写成随手可加的参数 ⇒ 三处补「**必须指向已存在的文件**」；脚本 docstring 另注明
  **`--config` 路径相对 cwd，不是相对 `--root`**。
- **F2（较重，设计自相矛盾）**：任务单 §0 写「分开做两份，必然漂移」，而 §4.4 的落地**正是两份实现**
  （Python 脚本 + hook 内 Node），防漂移手段只有「注释互指」——无机械校验。
  ⇒ 改为**阈值单一真源**：仓库有 `<repo>/doc-budget.json` 时，两处读**同一文件**；无则加 **A14 断言**两侧 `DEFAULTS` 相等。
  §4.2 的 `budget` entry 字段 `docs` → `config`；§4.7 加「不把阈值硬编码进 `entrypoints.mjs`」；§6 未验证加一条。
- **F3（约定缺失）**：`doc-budget.json` 的落点与入库性原先没写 ⇒ 补「放**仓库根**；落盘后跑
  `git check-ignore -v` 必须无输出（stock-agent 实测无输出 ✅）」。

**刻意未改**：`.workbuddy/memory/2026-10-05.md:204` 的旧口径（日志 append-only，已由本日 D 段更正）；
`docs/reviews/…:172` 与带墓碑的 `-bloat-control-optimized…:208/275`（时点证据，按协议不回改）。
