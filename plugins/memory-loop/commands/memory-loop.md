---
description: 把 hook 收集的记忆候选蒸馏进项目长期记忆
argument-hint: "[status]"
---

把 `<repo>/.zcode/memory/candidates.jsonl` 里 hook 收集的候选，蒸馏成
`<repo>/.zcode/memory/MEMORY.md` 里的长期记忆。

## 为什么需要这一步

上游 `stop-memory.js` 钩子只做**机械**判断（命中"文件改动/决策"信号就把回复前 400 字追加进 jsonl），
所以 `candidates.jsonl` 里是**原始回复片段**，不是记忆。整段注入上下文既长又噪。
**语义蒸馏是脚本做不了、必须由模型来做的一步** —— 本命令就是它。

## 步骤

1. **定位项目根并读现状。** 必须先解析到仓库根再读 —— 从子目录触发时相对路径会落空。

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   echo "== 候选 =="; wc -l "$ROOT/.zcode/memory/candidates.jsonl" 2>/dev/null || echo "(无)"
   echo "== 现有记忆 =="; cat "$ROOT/.zcode/memory/MEMORY.md" 2>/dev/null || echo "(无)"
   echo "== 蒸馏进度 =="; cat "$ROOT/.zcode/memory/state.json" 2>/dev/null || echo "(无)"
   ```

2. **`$ARGUMENTS` 是 `status`** → 只汇报上面三项，到此为止。

3. **读候选，逐条判断值不值得留。** 留下（符合任一条即可）：
   - 一条**会重复用到**的口径或约定
   - 一个踩过并绕过的**非显然**的坑（附根因，不只记症状）
   - 一个对外部系统的既有事实（路径、端口、账号、命令）

   丢掉：过程叙述、一次性任务描述、收尾总结、`git log` 已经记着的东西。

4. **写进 `MEMORY.md`。** 规则：
   - **按主题分组，不按时间** —— 时间顺序对检索毫无帮助
   - 每条一行，短到能被扫读
   - 与已有条目重复 → **合并**，不新增；已失效 → **删掉**
   - 整份文件控制在 ~200 行内。超了就删最空洞的，不是最老的
   - 文件首行保留 `<!-- memory-loop -->` 便于识别与统计

5. **推进蒸馏游标**（数字 = 当前候选总行数；这样 SessionStart 不再重复提示）：

   ```bash
   ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   ( cd "$ROOT" && node -e "
     const fs=require('fs');
     const p='.zcode/memory/candidates.jsonl';
     const n=fs.existsSync(p)?fs.readFileSync(p,'utf-8').split('\n').filter(Boolean).length:0;
     fs.mkdirSync('.zcode/memory',{recursive:true});
     fs.writeFileSync('.zcode/memory/state.json',JSON.stringify({distilled:n,updatedAt:new Date().toISOString()}));
     console.log('distilled =',n);
   " )
   ```

6. **报告**：读了多少条 / 留下几条 / 丢了几条 / MEMORY.md 现在多少行。

## 铁律

- **别把 `candidates.jsonl` 整个搬进 `MEMORY.md`** —— 那是转录，不是蒸馏。搬过去只会让上下文变贵。
- 某条**不确定**是否值得留 → 问一下，不要默认保留。
- 只改 `.zcode/memory/` 下的文件。不要动 `AGENTS.md`、不要动源码。
- 若 `candidates.jsonl` 里大量条目是同一个主题的重复（比如同一件事讲了五遍）→ 合并成一条，并在报告里说明。
