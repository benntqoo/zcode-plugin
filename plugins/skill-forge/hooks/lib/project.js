// skill-forge — 解析「当前项目的 skill 落点」
//
// 为什么单独成文件：Stop 与 SessionStart 两个钩子都要用同一套判定，
// 而这段逻辑里藏着一个必须显式挡掉的边界 ——
//
//   当工作区本身就是用户 home（cwd = C:\Users\Ben）时，
//   「项目级 .zcode/skills」= C:\Users\Ben\.zcode\skills = 用户级目录，
//   两者路径重合。此时若照推，会打着「项目专属」的旗号把 skill 写进全局库。
//
// 依据：ZCode 官方 zcode-configuration-guide（v0.3.0）
//   用户级   ~/.zcode/skills/  、 ~/.agents/skills/
//   工作区级 <repo>/.zcode/skills/ 、 <repo>/.agents/skills/
//   扫描顺序：从 cwd 向上到仓库根，每一层都算，越深的目录优先级越高。
//
// 注意：用户级优先于工作区级（first same-named skill wins, user scope has priority），
// 所以项目级同名 skill 会被 ~/.zcode/skills/ 里的遮蔽 —— 这是 ZCode 的既定行为，
// 本模块不改变它，只在写之前把落点算准。

import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { homedir } from "os";

const MAX_UP = 40;

/** 归一化路径用于比较：统一分隔符、去尾斜杠；Windows 下忽略大小写。 */
export function normPath(p) {
  let s = resolve(String(p)).replace(/[\\/]+$/, "").replace(/\\/g, "/");
  if (process.platform === "win32") s = s.toLowerCase();
  return s;
}

/**
 * 从 start 向上找项目根：**最近的标记获胜**，`.git` 与 `.zcode` 同等权重。
 * 同一个目录里两者都有时无所谓谁先 —— 反正都返回该目录。
 * 一个都找不到则回退 start 本身。
 *
 * 为什么是「就近」而不是「`.git` 绝对优先」：ZCode 自己的发现顺序里，
 * 越深的工作区 `.zcode/skills` 优先级越高。若让高位的 `.git` 越过低位自带的
 * `.zcode`，算出的落点就会跟 ZCode 实际读取的位置不一致 —— 文件写了却不生效。
 */
export function findProjectRoot(start) {
  let dir = resolve(start);
  for (let i = 0; i < MAX_UP; i++) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, ".zcode"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

/**
 * 算出本次会话应当使用的 skill 落点。
 *
 * @param {string} cwd 钩子 payload 里的 cwd（可空，回退 process.cwd()）
 * @returns {{root: string, skillsDir: string, isUserLevel: boolean}}
 *   skillsDir   绝对路径，写文件用这个
 *   isUserLevel true 表示落点与用户级目录重合（cwd 在 home）——调用方应放弃推送
 */
export function resolveSkillTarget(cwd) {
  const start = cwd && String(cwd).trim() ? String(cwd) : process.cwd();
  const root = findProjectRoot(start);
  const skillsDir = join(root, ".zcode", "skills");
  const userSkills = join(homedir(), ".zcode", "skills");

  const isHome = normPath(root) === normPath(homedir());
  const collides = normPath(skillsDir) === normPath(userSkills);

  return {
    root,
    skillsDir,
    isUserLevel: isHome || collides,
  };
}
