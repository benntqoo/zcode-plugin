// 三个插件的 findProjectRoot 标记表一致性（m3 回归，2026-11-15）：
// memory-loop / skill-forge 曾只认 .git/.zcode，project-guardrails 认 .git/.zcode/.agents，
// 同一工作区会算出不同根。现在三份必须同表 —— 一个都不能再漂。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot, normPath, resolveSkillTarget } from "../plugins/skill-forge/hooks/lib/project.js";
import { findProjectRoot as mlFind } from "../plugins/memory-loop/hooks/lib/project.mjs";
import { findProjectRoot as pgFind } from "../plugins/project-guardrails/hooks/lib/project.mjs";

test("m3 回归：仅有 .agents 标记的子目录，三个插件都就地定根（不再爬到外层 .git）", () => {
  const outer = mkdtempSync(join(tmpdir(), "roots-outer-"));
  const inner = join(outer, "inner");
  try {
    mkdirSync(join(outer, ".git"), { recursive: true });
    mkdirSync(join(inner, ".agents"), { recursive: true });
    for (const f of [findProjectRoot, mlFind, pgFind]) {
      assert.equal(f(inner), inner, f.name);
    }
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});

test("就近标记赢：内层 .zcode 优先于外层 .git（与 ZCode 越深越优先对齐）", () => {
  const outer = mkdtempSync(join(tmpdir(), "roots-near-"));
  const inner = join(outer, "inner");
  try {
    mkdirSync(join(outer, ".git"), { recursive: true });
    mkdirSync(join(inner, ".zcode"), { recursive: true });
    for (const f of [findProjectRoot, mlFind, pgFind]) {
      assert.equal(f(inner), inner);
    }
  } finally {
    rmSync(outer, { recursive: true, force: true });
  }
});

test("祖先无标记的临时目录：三个插件找到同一个根（本机上游常带 ~/.zcode 等标记，一致性才是真不变量）", () => {
  const bare = mkdtempSync(join(tmpdir(), "roots-bare-"));
  try {
    const roots = [findProjectRoot, mlFind, pgFind].map((f) => f(bare));
    assert.deepEqual(roots, [roots[0], roots[0], roots[0]]);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("normPath：分隔符归一 + 去尾斜杠；Windows 下忽略大小写（其余平台跳过该断言）", () => {
  assert.equal(normPath("C:\\A\\B\\"), normPath(process.platform === "win32" ? "c:/a/b" : "C:/A/B"));
});

test("resolveSkillTarget：cwd 就是 home 时判 isUserLevel（防把 skill 写进全局库）", () => {
  assert.equal(resolveSkillTarget(homedir()).isUserLevel, true);
  const tmp = mkdtempSync(join(tmpdir(), "roots-home-"));
  try {
    mkdirSync(join(tmp, ".git"), { recursive: true });
    assert.equal(resolveSkillTarget(tmp).isUserLevel, false);
    assert.ok(resolveSkillTarget(tmp).skillsDir.endsWith(join(".zcode", "skills")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
