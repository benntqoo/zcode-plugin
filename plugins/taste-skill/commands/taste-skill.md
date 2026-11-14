---
description: 调用 taste-skill 反平庸建站引擎（建站/重设计/检查），路由到插件自带的 design-taste-frontend 技能
argument-hint: "<brief 或目标>  例: 给这家咖啡店建官网 · redesign index.html · consistency.mjs 检查现有页"
---

把 `$ARGUMENTS` 作为 taste-skill 建站引擎的一次调用执行。本插件自带
`design-taste-frontend` 技能（`skills/taste-skill/SKILL.md`），**技能才是正脑** ——
按下面的顺序走：

1. `$ARGUMENTS` 为空：读技能正文第 4 节「The run」第 0-1 步——先问清客户与 brief，
   再把生意分类成六种之一（`software` / `gaming` / `tech` / `product` / `service` /
   `place`），然后按流程继续。
2. 建站或重设计：严格按技能正文执行——deal 发牌（`start.mjs` +
   `assets/layout/deal.mjs`）→ 从 `assets/starter.html` 起步 →
   `consistency.mjs` 多宽度真浏览器检查 → `gate.mjs` 收口到 `GATE: PASS`。
3. 只检查已建好的页面：`node <技能目录>/scripts/consistency.mjs <页面或URL>
   --page <kind>`； finish gate 手动入口：`node <技能目录>/scripts/gate.mjs`。

提示：finish gate 在本插件里还接了 Stop 钩子——`gate.mjs --start` 布防之后，
每次会话收尾会自动跑闸门，无需手动收口。
