# taste-skill（ZCode 适配版）

把上游 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) —— 「让编码智能体有品味」的
反平庸前端 skill（111k+ stars）—— 以 ZCode 插件形态落地：**1 个 skill（`design-taste-frontend`）
+ 1 个 `/taste-skill` 命令路由 + Stop 完成闸门钩子**。上游支持 Claude Code / Codex / 通用
`.agents` 三通道但没有 ZCode；本插件不改上游代码，直接 vendor 其 `skills/taste-skill/` 整目录。

引擎核心：按生意六分类（software / gaming / tech / product / service / place）发牌
调色板、Google Fonts 配对、hero 布局；真实照片（Wikimedia Commons 内置包，页脚署名）与
真实产品 UI；shader/滚动场景只给 tech 页；`consistency.mjs` 在无头 Chrome 里按
1440/1024/820/768/390 五宽度检查；`gate.mjs` 完成闸门扣住收尾直到 `GATE: PASS`。

## 来源与版本

| 项 | 值 |
|---|---|
| 上游仓库 | https://github.com/Leonxlnx/taste-skill（MIT） |
| vendored 版本 | `2.5.1`（插件版本号 = 上游版本号，见 `.zcode-plugin/plugin.json`） |
| vendored 来源 | 上游 commit `f6b7657` 的 `skills/taste-skill/`（2026-11-07，`diff -r` 逐字节一致） |
| 排除内容 | 无 —— skill 目录内没有宿主专用件（`.claude-plugin` / `.codex-plugin` / `.agents` 都在仓库根，未 vendor） |
| 未改动 | `SKILL.md`（含其 frontmatter `hooks:` 块，ZCode 静默忽略）、`scripts/`、`assets/`、`library/`、`references/` 全部上游原样 |

## 运行要求

- **Node 22+**（脚本零依赖、无 API key、不装任何东西）
- **Chrome / Edge / Chromium**（各脚本自动探测 Windows 标准位；非标准位设 `CHROME_PATH`）
- 可选 **ffmpeg**（PATH 上）—— 只影响照片 WebP 输出与 hero 手机裁剪，缺了照常跑

## 安装

仓库根本身是市场源（见根 [README](../../README.md)）：**Settings → Plugins → Add marketplace**
指向本仓库目录 → 对 `taste-skill` 点 **Install** → **开新会话**。

## 用法

- **命令入口**：`/taste-skill <brief 或目标>`（见 [commands/taste-skill.md](commands/taste-skill.md)）。
- **自动触发**：说「给这家店建官网」「重设计这个 landing page」等。⚠️ 上游 SKILL.md 的
  description 有 904 字符，触发句在第 567 字符 —— ZCode 只注入前 250 字符，自动触发弱化，
  拿不准就用命令入口或点名「用 taste-skill」。
- **手动脚本入口**（技能目录即 `plugins/taste-skill` 安装缓存下的 `skills/taste-skill`）：
  - 发牌：`node <skill>/scripts/start.mjs deal --page <kind>`
  - 检查：`node <skill>/scripts/consistency.mjs index.html --page <kind>`
  - 闸门：`node <skill>/scripts/gate.mjs --start index.html --kind <kind> --category "…" --primary "…"`

## 完成闸门钩子（Stop 桥）

上游把 Stop hook 写在 **SKILL.md frontmatter 的 `hooks:` 块**里 —— ZCode 对 skill
frontmatter 只认 name/description/when_to_use/metadata，`hooks:` 被静默忽略。本插件用
**插件级 `hooks/hooks.json`**（标准位置自动加载，免项目级 hooks 逐仓库信任）把同一防线桥回来：
`Stop → node ${ZCODE_PLUGIN_ROOT}/skills/taste-skill/scripts/gate.mjs --hook claude`。

与上游等价的三个根据：

1. **信封免改**：`gate.mjs` 的 stdin 解析宽松（信封字段可选、2 秒超时兜底），stdout 输出
   Claude 协议 `{decision:'block', reason}` 且恒 exit 0 —— ZCode Stop 事件同协议。
2. **永不卡死**：引擎自带 never-trap 硬化 —— uncaughtException / 未布防 / 他人会话持有 /
   轮次用尽 / 用户 `--done` / 闲置超 24h 一律放行；本插件不改这些行为。
3. **开销有界**：无布防构建时只做文件系统扫描即退（约 node 启动级耗时，不拉浏览器）；
   有布防时自预算 9.5 分钟，塞进 `timeoutMs: 600000`（对齐上游 600s）。

注：若宿主对 Stop 的 decision JSON 语义有出入，钩子退化为提示（stderr 的 GATE 行仍可见），
技能正文第 4 步的手动闸门命令不受影响。

## 技能名与目录名

上游 SKILL.md `name: design-taste-frontend`、目录名 `taste-skill`（上游自己的 Claude 插件
也是这个组合）。ZCode 对「以谁为准」未定，按本仓库审计口径这是一条 WARN 而非 ERROR ——
为保机械 diff，维持上游原样，不重命名。

## 更新 runbook（上游出新版时）

```bash
git clone --depth 1 https://github.com/Leonxlnx/taste-skill /tmp/taste-new
# 1) 比对产物
diff -r /tmp/taste-new/skills/taste-skill plugins/taste-skill/skills/taste-skill
# 2) 重新 vendor（无排除清单，整目录重铺）
rm -rf plugins/taste-skill/skills/taste-skill
cp -r /tmp/taste-new/skills/taste-skill plugins/taste-skill/skills/
# 3) 三处版本号对齐：plugin.json、根 marketplace.json、本 README 的 vendored 版本与 commit
```

上游迭代很快（2.5.0→2.5.1 隔 2 天），更新前先扫一眼其 CHANGELOG 是否动了 `gate.mjs`
的钩子协议（`--hook` 参数与 MODES 表）—— 那是本插件唯一的接线点。

## License

上游 taste-skill，MIT，版权属 Leonxlnx —— 见本目录 [LICENSE](LICENSE)。
skill 内置照片来自 Wikimedia Commons 等开放档案，署名由 `photos.mjs` 写入页面页脚，
随分发保留。本插件的适配 glue（hooks.json / command / README）随本仓库以 MIT 分发。
