---
description: 体检 ZCode skill 库:数量预算、规格合规、边界重叠
argument-hint: "[可选: 只检查某个目录]"
---

体检 skill 库。**只读诊断，不要自动修改** —— 改什么由用户决定。

默认只看**本项目**的 `.zcode/skills/`；用户明确要求时才连全局库 `~/.zcode/skills/` 一起看。
两块都看时，**必须查同名遮蔽**（见检查项 1b）—— 那是 ZCode 最反直觉的一条规则。

## 为什么需要

ZCode 每轮把**所有启用中** skill 的 name + description 前 250 字符注入上下文，总量有固定预算。超预算后注入退化成「只有名字」，模型不知道何时该用哪个，**自动触发率骤降**。这个悬崖没有任何界面警告。

## 检查项

### 1. 清单与计数

先确认项目根与项目级 skill 目录：

```bash
git rev-parse --show-toplevel 2>/dev/null || pwd
ls -la .zcode/skills/ 2>/dev/null || echo "(本项目还没有 .zcode/skills/)"
```

区分三类，分别报数：

- **实体目录** —— 真正占预算的
- **符号链接**（`lrwxrwxrwx`）—— 指向外部，标明来源，并检查目标是否失效
- 给出总数

### 1b. 同名遮蔽（两块都查时才做）

ZCode 的扫描顺序里**用户级排在项目级前面**，且「first same-named skill wins」。
结果：`~/.zcode/skills/foo/` 与 `<repo>/.zcode/skills/foo/` 同名时，**全局那份胜出**，
项目级被静默遮蔽 —— 症状是「文件明明改了，行为没变」。

```bash
comm -12 \
  <(ls ~/.zcode/skills/ 2>/dev/null | sort) \
  <(ls .zcode/skills/ 2>/dev/null | sort)
```

有输出 → 逐个列出，提示用户：要么给项目级改名，要么去改全局那一份。

### 2. 规格合规

| 字段 | 要求 | 违规后果 |
|---|---|---|
| `name` | 必填 | **整条 skill 被丢弃** |
| `description` | 必填，≤1024 字符 | 缺失或被丢弃；超限同样**整条丢弃**，不是截断 |
| `when_to_use` | 可选 | — |
| `metadata` | 可选，自由 object | — |

其余字段（如 `author`、`version`、`license` 放错层级）会被**静默忽略**。

```bash
D=.zcode/skills          # 要看全局库就换成 ~/.zcode/skills
for f in "$D"/*/SKILL.md; do
  [ -e "$f" ] || continue
  n=$(basename "$(dirname "$f")")
  d=$(grep -m1 '^description:' "$f" | wc -c)
  printf "%-30s desc=%s\n" "$n" "$d"
done
```

另外检查：正文超 100KB 会在加载时被截断。

### 3. 边界重叠

⚠️ **不要用关键词计数判定重复。** 一个 skill 反复出现某个词，只说明那是它的主题。

判定必须**逐段读原文**，问的是：

> **同一个事实 / 同一条命令，是不是真的在两个文件里各写了一遍？**

### 4. 描述质量

抽查 `description`：是否写清了**什么时候用**？只描述「它是什么」的会被模型忽略。

## 输出格式

```
## 数量
实体 N 个 + 软链 M 个 = 合计 X

## 不合规（会导致 skill 被静默丢弃）
| skill | 问题 | 修法 |

## 边界重叠（逐段读过后确认的）
| skill A | skill B | 重叠的具体内容 | 建议 |

## 描述质量问题
| skill | 现描述 | 问题 |

## 建议
（不自动执行）
```
