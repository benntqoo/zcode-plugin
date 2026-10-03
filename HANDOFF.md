# HANDOFF — skill-forge 插件

> 交接时间：2026-10-03 23:00
> 状态：**代码已完成并测试通过，等待 GUI 安装。**
> 上一轮会话产物，新会话直接从这里接。

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
        └── lib\io.js                   自带的 hook I/O 库
```

---

## 三、已完成

| 项 | 状态 |
|---|---|
| 插件包 9 个文件 | ✅ 已生成并迁移到 `D:\Code\zcode-plugin` |
| 语法检查（3 个 js） | ✅ `node --check` 全过 |
| 冒烟测试 | ✅ 5 组场景全过（见下） |
| `~/.zcode/AGENTS.md` | ✅ 已追加三铁律（36 → 103 行） |
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
| 状态文件记账 | `{"vf1":1}` | ✅ |

> ⚠️ 踩过的坑：测试消息若短于 **80 字符**会被 `trim().length < 80` 拦掉，看起来像「没触发」。
> 复测时用完整长度的消息（实测 285 字节可用）。

---

## 四、待办（GUI，脚本无法代做）

1. **添加市场**
   ZCode → `Settings` → `Plugins` → `Create` → `Add marketplace` → 本地目录 → `D:\Code\zcode-plugin`

2. **安装插件**
   市场 `zcode-plugin` 里点 `skill-forge` 的 `Install`。装完应显示 **Commands: 2 / Hooks: 2**

3. **开新会话验证**
   必须开新会话 —— ZCode 在会话启动时快照 hook 配置，**不热加载**
   - 打 `/` 应看到 `skill-forge`、`skill-audit`
   - 跑一个会踩坑的多步任务，观察是否自动写 skill

---

## 五、未验证 / 存疑（别当结论用）

| 项 | 说明 |
|---|---|
| `marketplace.json` 的位置 | 官方文档说「at the root」，但本机 ponytail 放在 `.claude-plugin/`。当前按文档放根目录，**未经实测**。若添加市场失败，先试把它复制一份到 `.zcode-plugin/` |
| `plugins/` 子目录约定 | 官方文档原文是 "Put plugins under the marketplace repository's `plugins/` directory"，据此布局，**未经实测** |
| `ZCODE_PLUGIN_ROOT` 变量替换 | 官方文档明确列了该变量，但本机无法实测替换行为 |
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

- **是否 git init**
  `D:\Code\zcode-plugin` 目前不是 git 仓库。作为「正式项目」建议初始化，但未执行 —— 等确认。

- **ZCode 原生 Project Memory 开关**
  `Settings → General → Memory`，默认关闭。与本机制职责重叠且**不可浏览/不可清除**。建议二选一。
