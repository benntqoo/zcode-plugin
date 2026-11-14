---
description: 调用 impeccable 设计引擎的动词（polish/critique/audit/bolder…），路由到插件自带的 impeccable 技能
argument-hint: "<verb> [target]  例: polish src/app.html · audit · critique · detect src/"
---

把 `$ARGUMENTS` 作为 impeccable 设计引擎的一次调用执行。本插件自带 `impeccable`
技能（`skills/impeccable/SKILL.md`），**技能才是正脑** —— 按下面的顺序走：

1. `$ARGUMENTS` 为空：读技能里的 Commands 表，列出可用动词请用户选择，结束。
2. 解析出动词（与可选 target）后，按技能的 Setup 流程执行：
   先跑一次 `<技能目录>/scripts/impeccable context`（Windows 无 sh 时用
   `impeccable.cmd`）拿到 base dir，再按技能指向的该动词 playbook 走完整流程。
3. 目标是「纯检测、不进设计流程」时直接跑：
   `npx impeccable detect <target>`（62 条确定性规则，无需 LLM；`--json` 出机器可读结果）。

动词速查：`bolder` `quieter` `distill` `colorize` `typeset` `layout` `animate`
`delight` `overdrive`（Steer）· `critique` `audit`（Review）· `polish` `harden`
`clarify` `adapt` `optimize` `onboard`（Finish/Iterate）· `live` `generate`（浏览器内实时迭代）·
`shape` `init` `document` `extract`（Plan）。
