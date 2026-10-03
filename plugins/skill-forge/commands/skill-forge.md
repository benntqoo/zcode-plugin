---
description: 把本轮对话沉淀成一个可复用 skill
argument-hint: "[可选: skill 名(kebab-case)]"
---

把这次对话里踩过的坑、定下的口径、走通的多步流程，沉淀成一个可复用的 skill。

## 步骤

1. **先判断值不值得。** 满足任一条才继续，否则直接说明「本轮无需沉淀」并停止：
   - 走了 5 步以上才走通，中间有试错
   - 踩到并绕过了一个非显然的坑
   - 定下了一条会重复用到的口径或决策

2. **确定边界。** 先列出现有 skill：

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   ls "$ROOT/.zcode/skills/" 2>/dev/null || echo "(本项目还没有 skill 目录)"
   ```

   ⚠️ 必须先解析到**仓库根**再列 —— 从子目录触发时 `.zcode/skills/` 相对路径会落空，
   于是误判成「本项目还没有 skill」，接着就会新建一个和已有 skill 重复的东西。
   若已有 skill 覆盖同一主题 → **改那个，不要新建**。metadata 预算有限，重叠会拉低自动触发率。

   ⚠️ 落点是**本项目**的 `.zcode/skills/`，不是全局 `~/.zcode/skills/`。
   全局库里的同名 skill 会**遮蔽**项目级的（ZCode 规则：user scope 优先），所以别把项目专属的东西写去全局。

3. **定名。** kebab-case，名字要能一眼看懂用途。可用 `$ARGUMENTS` 指定；未指定则拟一个并说明理由。

4. **写文件** `.zcode/skills/<name>/SKILL.md`（项目根下，随 git 提交）：

   ```yaml
   ---
   name: <kebab-case>
   description: <写清「什么时候用」，不是「它是什么」。触发条件放最前面，≤1024 字符>
   when_to_use: <可选，补充触发时机>
   metadata:
     author: agent
     version: 1.0.0
   ---
   ```

   正文要求：
   - **命令写全**，不要写「运行相应的命令」
   - **判据写明** —— 什么情况下算对，什么情况下算错
   - **坑单独成节**，写清 现象 → 原因 → 解法
   - 不要写「本 skill 用于…」这种废话开头，直接进内容
   - 控制在 200 行以内，超了说明该拆

5. **验规格。** `description` 不能超 1024 字符，`name` 不能缺 —— 这两个任一不合规，整条 skill 会被静默丢弃。

6. **报结果。** 一句话：路径 + 覆盖什么场景。不要问「还要不要改」。

## 反模式

- ❌ 把一次性操作写成 skill
- ❌ 把项目事实（用 pnpm、测试命令是 X）写成 skill —— 那是 memory 的活
- ❌ 复制官方文档当正文 —— 没有你踩过的坑，就没有价值
- ❌ 为凑数硬写 —— 每条 skill 都占每轮注入的预算
