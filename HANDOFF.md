# HANDOFF — skill-forge 插件

> 更新：2026-10-04 01:15
> 状态：**v1.1.0 已安装启用；skill 落点已从全局改为「项目级」（本次变更）**
> 新会话直接从这里接。

**最新变更（2026-10-04）**：原本 skill 一律写进全局库 `~/.zcode/skills/`。
现改为写入**当前项目**的 `<repo>/.zcode/skills/`，并新增 `hooks/lib/project.js` 做路径解析。
详见表「八、落点为何是项目级」。

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

3. **重装到 v1.1.0** ← **当前唯一待办（GUI）**
   本地目录市场**不会自动感知文件变化**。本次改了钩子与命令 + bump 到 1.1.0，
   需要在 `Settings → Plugins → Installed` 里对 `skill-forge` 执行更新/重装。
   缓存路径参考：`~/.zcode/cli/plugins/cache/zcode-plugin/skill-forge/<version>/`

4. **开新会话验证**
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
  - `findProjectRoot()`：就近找 `.git`，其次 `.zcode`，都没有则回退 cwd（最多向上 40 层）
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
