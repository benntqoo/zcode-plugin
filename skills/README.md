# skills/

本仓库的**技能源库** —— 与 `plugins/` 平行、彼此独立。

| | `plugins/` | `skills/`（本目录） |
|---|---|---|
| 单元 | 一个插件（可含 skills / commands / hooks / mcpServers） | 一个技能（只含 `SKILL.md` + 可选 `references/`） |
| 分发 | 走市场：`marketplace.json` 的 `plugins[]` | **无独立分发通道** —— 手动复制或软链到用户级 |
| 生效 | 安装插件 + 重开会话 | 落到技能根即可（重开会话或 `/clear`） |

## 安装一个技能

ZCode 的用户级技能根有两个（源码确认）：`~/.zcode/skills/` 与 `~/.agents/skills/`。
后者是跨 agent 共享位（同一份目录也被其它客户端读取），**推荐装这里**。

```bash
# 复制
cp -r skills/<name> ~/.agents/skills/<name>

# 或软链（改本仓库文件即生效，适合开发中）
ln -s "$(pwd)/skills/<name>" ~/.agents/skills/<name>
```

更新：复制方式需重新 `cp`；软链方式免更新。装完**开新会话或 `/clear`** 才生效。

## 落点约定

每个技能一个目录，`SKILL.md` 必需，其余按需：

```
skills/<name>/
├── SKILL.md          frontmatter：name / description（+ 可选 when_to_use / metadata / license）
└── references/       可选，长文档、模板、实证依据
```

- `name` 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`
- `description` 是**唯一触发依据**，决定它什么时候被加载 —— 写清「做什么」+「MUST USE 当……」
- 详细规范见官方 `skill-creator` 技能与根 `README.md`

## 当前收录

| 技能 | 作用 | 文档 |
|---|---|---|
| `doc-protocol` | 文档职责路由与进度真值协议（通用层 + 项目覆盖档机制） | [doc-protocol/SKILL.md](doc-protocol/SKILL.md) |

> ⚠️ 用户级技能**优先于**项目级：同名时 `~/.agents/skills/` 那份会**遮蔽**项目内的同名技能。
> 所以「项目覆盖」不要靠同名技能实现，用普通文件（见 `doc-protocol` 第零节）。
