// Hook — session-skill-rules.js  (SessionStart, matcher: compact|clear)
//
// 作用：会话被压缩或清空之后，把「skill 沉淀三铁律」重新注入一次。
//
// 为什么只匹配 compact|clear 而不匹配 startup：
//   正常启动时，ZCode 已经读取 ~/.zcode/AGENTS.md，规则本来就在上下文里。
//   再注入一遍是纯浪费 token。
//   但 compact（上下文压缩）之后，AGENTS.md 的内容可能被压掉 —— 这时才需要补刀。
//
// 这是一条保险，不是主渠道。主渠道是 AGENTS.md。

import { readStdinAsync, field, emitContext, emitPass } from "./lib/io.js";
import { resolveSkillTarget } from "./lib/project.js";

const payload = await readStdinAsync();
const eventName = field(payload, "hook_event_name", "hookEventName");

if (eventName !== "SessionStart") {
  emitPass();
}

// 落点按当前工作区现算 —— 插件全局安装，规则注入时必须指向「本项目」而非全局库。
// isUserLevel（工作区就是 home）时没有项目级落点，退回用户级目录，语义上无歧义。
const target = resolveSkillTarget(field(payload, "cwd"));
const skillDir = target.isUserLevel
  ? "~/.zcode/skills"
  : target.skillsDir.replace(/\\/g, "/");

emitContext(
  "SessionStart",
  [
    "[skill-forge] 上下文已被压缩，重新载入 skill 沉淀规则：",
    "",
    "1. 做完就沉淀 —— 本轮若走过 5+ 步的试错流程、绕过非显然的坑、或定下会重复用的口径，",
    "   收尾前写入 `" + skillDir + "/<kebab-name>/SKILL.md`（本项目专属，不要写全局库）。不要问「要不要存」。",
    "   frontmatter 只认 name / description / when_to_use / license / metadata。",
    "   description 必须写清「什么时候用」，会被截断到 250 字符注入上下文，触发条件放最前面。",
    "",
    "2. 用过就复检 —— 本轮调用过任何 skill，收尾前回读一遍，发现过时命令/错工具名/缺步骤就同轮改掉。",
    "",
    "3. 读到错就修 —— 读任何 SKILL.md 时发现错字或失效路径，当场改，不要只报告。",
    "",
    "不值得沉淀的情况：一次性问答、纯查询、没有新方法论。不要为凑数写。",
    "每条 skill 都占每轮注入的 metadata 预算，装多了会让自动触发率骤降。",
  ].join("\n")
);
