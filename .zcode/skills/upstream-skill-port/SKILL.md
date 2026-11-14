---
name: upstream-skill-port
description: 把上游多工具 skill/设计系统适配成 ZCode 插件的评估与落地方案。当要「给 ZCode 适配某个上游项目」「vendor 上游 skill」「上游不支持 ZCode 怎么办」「评估某工具与 ZCode 的兼容性」时使用。
when_to_use: 上游项目（如 pbakaus/impeccable 类）只支持 Claude Code/Cursor 等而无 ZCode 通道；决定手动落位、vendor 插件还是上游 PR 时。
metadata:
  author: agent
  version: 1.0.0
---

# upstream-skill-port — 跨工具 skill 适配成 ZCode 插件

实例：pbakaus/impeccable 4.9.1 → `plugins/impeccable/`（本仓库第 20 段）。

## 一、评估四问（决定「天然兼容度」）

1. **产物格式**：上游有没有「通用/多工具产物」（如 `.agents/skills/` 变体）？其 SKILL.md frontmatter
   字段集与 ZCode 允许集（name/description/when_to_use/metadata）**求交集** —— 未知字段被静默忽略不算错，
   逐字段核对即可。上游仓库通常有 `scripts/lib/transformers/providers.js` 这类 provider 注册表，
   一眼看清所有变体。
2. **钩子信封**：上游 hook 引擎对 Claude 风格 snake_case 信封（`hook_event_name`/`tool_name`/`tool_input`）
   的 **fallback 是什么**？impeccable 的 `resolve_harness` fallback=claude ⇒ ZCode 信封免改直喂，
   不需要设 harness 环境变量。
3. **CLI 独立性**：引擎/CLI 是否零集成可用（`npx <pkg> detect` 这类）？可用则检测器能力即刻到手。
4. **自定位**：skill 是否自解析自身目录（而非依赖宿主注入路径）？impeccable 用
   `<skill-dir>/scripts/impeccable context` 上报 base dir ⇒ 放哪都能跑。

## 二、路径决策

- **A 手动落位**（~10 分钟）：通用产物复制到 `~/.agents/skills/`。缺钩子、缺命令入口、手动更新。
- **B vendor 插件**（推荐，本仓库实例）：`plugins/<name>/` + 市场安装。插件级 hooks **免信任门槛**
  （项目级 hooks 要逐仓库信任 —— ZCode 已知坑）；与市场通道一致。
- **C 上游 PR**：给 provider 注册表加 zcode provider（约 10 行配置 + ZCode 发现规则文档）。
  可与 B 并行，合并后 B 退化为薄壳。

**别叠加通道**：A（用户级 `~/.agents/skills/<name>`）与 B（插件内同名 skill）并存会撞同名 ——
ZCode 用户级 priority 高于项目级/插件，静默遮蔽，症状「文件在、行为不变」。

## 三、B 路线实现清单

1. vendor 通用产物整目录；**排除宿主专用件**（impeccable 的 `agents/*.toml` 是 Codex subagent）；
   带走 LICENSE/NOTICE（Apache-2.0 等要求随分发保留）。**SKILL.md 不改动** —— 更新时机械 diff。
2. 版本号策略：**插件版本 = 上游版本**（更新谱系可读）；plugin.json / marketplace.json / 插件 README
   三处 + vendored commit 号对齐。
3. 命令路由：ZCode 命令是静态 md，拿不到插件根变量 ⇒ 命令体**只做路由**（指向插件自带的 skill，
   由 skill 的自定位机制解析路径），不要在命令里猜安装缓存路径。
4. 钩子桥：hook 命令里可用 `${ZCODE_PLUGIN_ROOT}`（本仓库三个插件实测约定）；宿主差异包在
   node wrapper 里（见下节），hooks.json 保持 `command: node` 最小面。

## 四、Windows + Git Bash wrapper 三坑（全部实测复现）

node wrapper spawn 启动器时：

1. **喂给 MSYS sh 的路径必须正斜杠**。反斜杠路径让 bash 启动器 dirname 错位 —— bin 搜索跑到仓库根、
   VERSION 读空、exit 127，且静默（错误被 fallback 掩盖）。`p.split(path.sep).join('/')`。
2. **子进程输出用 `stdio: ['pipe','inherit','inherit']`**。手工 `data` 事件转发会和
   `process.exit()` 竞态，丢 stderr。
3. **launcherPath 显式携带**。不同启动命令形态里启动器位置不同（`['sh',[launcher,'hook']]` 在 argv[0]；
   `['cmd.exe',['/c',cmdPath,'hook']]` 在 argv[1]）—— 统一查同一个下标会让其中一支永远被跳过。

设计取向：钩子失败**传导退出码**不吞（引擎报错自带可操作指引）；wrapper 任何 spawn 失败才试下一支。

## 五、环境陷阱

- **发布 CDN 与 github.com 权限不同**：沙箱/CI 常放行 github.com（clone 可用）但拦
  `release-assets.githubusercontent.com`（release 下载必败）。诊断法：`curl -sIL` 跟 302。
  逃生口：`IMPECCABLE_BIN` / 源码 `cargo build --release -p <pkg>`（宽松 `channel = "stable"`
  不触发 rustup 下载；`RUSTUP_TOOLCHAIN=` 可绕 rust-toolchain.toml）。
- **node 读 `/tmp` 不走 MSYS 翻译**（会解析成 `<盘>:\tmp`）：跨 bash/node 传路径用 `$TMP`/`process.env.TEMP`。
- **description 250 字符截断**：ZCode 只注入前 250 字符，上游长 description 要确认触发词在前段
  （impeccable 恰好前 150 字符内含全部触发动词，可用）。

## 六、更新 runbook（模板）

```bash
git clone --depth 1 <upstream> /tmp/imp-new
diff -r /tmp/imp-new/<通用产物> plugins/<name>/skills/<name>   # 比对
rm -rf plugins/<name>/skills/<name> && cp -r <新产物> …        # 重铺（保持排除清单）
# 三处版本号 + vendored commit 对齐
```
