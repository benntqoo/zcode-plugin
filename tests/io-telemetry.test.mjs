// 遥测插件名推导直调测试 —— 回归 2026-11-15~19 的 "cache" 误名：
// 安装缓存路径 …\cli\plugins\cache\zcode-plugin\<名>\<版>\hooks\lib\io.* 里有两个
// "plugins" 段，lastIndexOf 取到 cli\plugins 后面的 cache。修法 = hooks 目录祖父法。
// 三份 io 库是自包含拷贝，必须同语义 —— 一份错就三份错，全测。
import { test } from "node:test";
import assert from "node:assert/strict";
import { telemetryPluginName } from "../plugins/memory-loop/hooks/lib/io.mjs";
import { telemetryPluginName as sfName } from "../plugins/skill-forge/hooks/lib/io.js";
import { telemetryPluginName as pgName } from "../plugins/project-guardrails/hooks/lib/io.mjs";

test("仓库源布局：plugins/<名>/hooks/lib/io.* → <名>", () => {
  assert.equal(telemetryPluginName("D:/Code/zcode-plugin/plugins/memory-loop/hooks/lib/io.mjs"), "memory-loop");
});

test("安装缓存布局：cache/<市场>/<名>/<版>/hooks/lib/io.* → <名>（不再误记 cache）", () => {
  const p = "C:/Users/Ben/.zcode/cli/plugins/cache/zcode-plugin/skill-forge/1.1.5/hooks/lib/io.js";
  assert.equal(sfName(p), "skill-forge");
  assert.notEqual(sfName(p), "cache");
});

test("无 hooks 祖先 → unknown（不抛错）", () => {
  assert.equal(pgName("C:/some/random/lib/io.mjs"), "unknown");
});

test("三份自包含拷贝同语义（同一输入同一输出）", () => {
  const cases = [
    "D:/repo/plugins/project-guardrails/hooks/lib/io.mjs",
    "C:/Users/x/.zcode/cli/plugins/cache/zcode-plugin/memory-loop/1.0.4/hooks/lib/io.mjs",
    "C:/no-hooks/here/io.mjs",
  ];
  for (const c of cases) {
    const want = telemetryPluginName(c);
    assert.equal(sfName(c), want);
    assert.equal(pgName(c), want);
  }
});
