#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check-doc-budget — doc-protocol 体量闸（参考实现）

把 doc-protocol 的体量阈值从「提示词自律」变成「可跑的闸」：
输出结构化 JSON，越线即**退出码非零**。收尾清单第 0 步跑它；输出同时可供
会话开场注入（project-guardrails 的 `entrypoints`）消费。

用法
----
    python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root .   # 任意仓库（cwd 为仓库根）
    python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --root D:/Code/stock-agent
    python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --config <repo>/doc-budget.json
    python ~/.agents/skills/doc-protocol/assets/check-doc-budget.py --quiet    # 只输出 JSON

退出码
------
    0  全部在预算内（可能带 warning）
    1  存在**硬越线**（violations 非空）—— 收尾时先处理，再做其余
    2  用法 / 配置错误（含 `--config` 指向的文件不存在）

`--root` 默认 cwd；`--config` 路径**相对 cwd**（不是相对 `--root`）。
`--config` 缺省时**自动发现** `<root>/doc-budget.json`（与钩子 `loadBudgetConfig` 的读取行为一致）；
root 下也没有该文件时才用 `DEFAULTS`。
⚠️ 显式给了 `--config` 就**必须指向已存在的文件** —— 不存在即 exit 2，不要当可选参数随手加；
自动发现的配置文件损坏同样 exit 2（闸是执法点，响亮失败优于静默回退默认）。

设计要点（对齐 doc-protocol 第一/三/四/五/七节）
- **热层才有硬预算**：指令文件、活账本。温/冷层只看归档线。
- **账本不变量**：活表**不得**含 `~~` 行（未完成投影）。这是唯一可机械校验的强约束。
- **软 / 硬分开**：条数、单行长度是 soft（warning）；字节、行数、死行数是 hard（violation）。
- 纯标准库；不写任何文件；只读。

本文件是**参考实现**，随 doc-protocol 技能分发（`assets/`）——
**不要在目标仓库里复制副本**：技能一改副本就陈旧，等于同一个脚本两个真源。
阈值/文件名差异用 `--config <repo>/doc-budget.json` 表达；默认值已是通用值，多数仓库零配置即用。

例外：目标仓库有 **CI / pre-commit 等独立于技能安装的消费方**时，才在仓库建**实例**，
并在文件头注明「派生自 `doc-protocol/assets/check-doc-budget.py`@<技能版本或日期>」，技能修订时同步
—— 那是**实例**，不是无脑复制。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata

# ---------------------------------------------------------------------------
# 默认预算（doc-protocol 通用默认；各仓库可 override 阈值）
# ---------------------------------------------------------------------------
DEFAULTS: dict = {
    # 热层文档：字节 + 行数硬预算；maxInstructions 为 standing instruction 条数
    "documents": [
        {
            "id": "handoff",
            "path": "handoff.md",
            "maxLines": 2000,
            "maxBytes": 512000,          # 500 KB
        },
        {
            "id": "instructions",
            "path": "AGENTS.md",
            "maxBytes": 61440,           # 60 KB（留 40% 余量对抗 100 KB 静默截断）
            "maxInstructions": 150,
        },
    ],
    # 活账本：交接待办表
    "ledger": {
        "path": "handoff.md",
        "from": None,                    # regex；None = 文件第一个 '^## ' 标题
        "to": r"^##\s+\d{4}-\d{2}-\d{2}",  # 第一个日期段标题（含）之前
        "maxBytes": 15360,               # 15 KB（hard）
        "maxLines": 40,                  # 含表头（hard）
        "maxItems": 30,                  # 活跃条数（soft）
        "maxRowBytes": 600,              # 单行（soft）
        "forbidCompleted": True,         # 活表不得含 '~~'（hard 不变量）
    },
    # 段内补记：**只从段头**取（`## YYYY-MM-DD(第N段补记M)…`），按「第N段」归组
    "addenda": {
        "path": "handoff.md",
        "maxPerSegment": 3,              # hard
        "datePattern": r"^##\s+\d{4}-\d{2}-\d{2}",
        "basePattern": r"第[\d一二三四五六七八九十百千零]+段",
        "countPattern": r"补记\s*(\d+)",
    },
    # 归档冷层：单片上限
    "archive": {
        "dir": "docs/archive",
        "maxFileBytes": 512000,          # 单片 500 KB（hard）
        "globSuffix": ".md",
    },
    # 段头格式（soft 提醒）
    "segmentHeader": {
        "match": r"^##\s+\d{4}-\d{2}-\d{2}",
        "expected": r"^##\s+\d{4}-\d{2}-\d{2}\(第[\d一二三四五六七八九十百千零]+段",
        "path": "handoff.md",
    },
}

STATUS_SYMBOLS = ("🔴", "🟡", "⏳", "✅", "❌")
# emoji 及变体选择符，用于近似计算「显示宽度」之外的字符数；这里只用 Python len()
_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_TABLE_SEP = re.compile(r"^\s*\|[\s:|-]+\|\s*$")
_HEADING = re.compile(r"^#{1,6}\s")
_LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+\S")
_FENCE = re.compile(r"^\s*(```|~~~)")


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------
def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _read(path: str):
    """返回 (text, bytes_len, lines) 或 None（不存在 / 读不了）。"""
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as fh:
        raw = fh.read()
    text = raw.decode("utf-8", errors="replace")
    return text, len(raw), text.split("\n")


def _bytes(s: str) -> int:
    return len(s.encode("utf-8"))


def _cell0(row: str) -> str:
    parts = row.split("|")
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return parts[0].strip() if parts else ""


def _header_index(lines):
    """表头行 = 紧邻表头分隔行之前的那一行；无分隔行则 -1。

    表头不是数据 —— 不排除它会让 `rows` 与 `noStatusRows` 各多 1
    （「状态 | 事项 | …」既不是待办，也不含状态符号）。
    """
    for i, ln in enumerate(lines):
        if _TABLE_SEP.match(ln):
            return i - 1 if i - 1 >= 0 else -1
    return -1


def _iter_table_rows(lines):
    """产出 (行号, 原文) 的数据行（跳过**表头行**与表头分隔行）。"""
    header = _header_index(lines)
    for i, ln in enumerate(lines):
        if i == header:
            continue
        if _TABLE_ROW.match(ln) and not _TABLE_SEP.match(ln):
            yield i, ln


# ---------------------------------------------------------------------------
# 各检查
# ---------------------------------------------------------------------------
def check_documents(root: str, specs) -> tuple[list, list, dict]:
    violations, warnings, report = [], [], {}
    for spec in specs or []:
        did = spec.get("id") or spec.get("path")
        path = os.path.join(root, spec["path"])
        info = _read(path)
        entry = {"path": spec["path"], "exists": info is not None}
        if info is None:
            report[did] = entry
            continue
        text, size, lines = info
        nlines = len(lines)
        entry.update({"lines": nlines, "bytes": size})
        if spec.get("maxLines") and nlines > spec["maxLines"]:
            violations.append({
                "code": f"{did}.lines", "object": did,
                "actual": nlines, "limit": spec["maxLines"],
                "message": f"{spec['path']}: {nlines} 行 > 上限 {spec['maxLines']} 行",
            })
        if spec.get("maxBytes") and size > spec["maxBytes"]:
            violations.append({
                "code": f"{did}.bytes", "object": did,
                "actual": size, "limit": spec["maxBytes"],
                "message": f"{spec['path']}: {size} B > 上限 {spec['maxBytes']} B",
            })
        if spec.get("maxInstructions"):
            cnt = count_instructions(lines)
            entry["instructions"] = cnt
            if cnt > spec["maxInstructions"]:
                violations.append({
                    "code": f"{did}.instructions", "object": did,
                    "actual": cnt, "limit": spec["maxInstructions"],
                    "message": f"{spec['path']}: {cnt} 条 standing instruction > 上限 {spec['maxInstructions']} 条（先删陈旧项）",
                })
        report[did] = entry
    return violations, warnings, report


def count_instructions(lines) -> int:
    """粗略数 standing instruction：代码围栏外的顶层列表项。"""
    n, in_fence, fence = 0, False, None
    for ln in lines:
        m = _FENCE.match(ln)
        if m:
            if not in_fence:
                in_fence, fence = True, m.group(1)
            elif ln.strip().startswith(fence):
                in_fence, fence = False, None
            continue
        if in_fence:
            continue
        if _LIST_ITEM.match(ln):
            n += 1
    return n


def _ledger_region(lines, spec):
    """返回 (start, end, 说明)。end 为开区间。"""
    from_re = spec.get("from")
    to_re = spec.get("to")
    start = 0
    if from_re:
        pat = re.compile(from_re)
        for i, ln in enumerate(lines):
            if pat.search(ln):
                start = i
                break
    else:
        for i, ln in enumerate(lines):
            if re.match(r"^##\s", ln):
                start = i
                break
    end = len(lines)
    if to_re:
        pat = re.compile(to_re)
        for i in range(start + 1, len(lines)):
            if pat.search(lines[i]):
                end = i
                break
    return start, end


_INLINE_CODE = re.compile(r"`+[^`\n]*`+")


def _is_completed_row(row: str) -> bool:
    """完成行 = 代码 span 之外存在 `~~`（行内反引号里引用的字面波浪线不算，
    含单/双反引号两种 span；钩子侧「成对 ~~」语义本就不受字面量影响）。"""
    return "~~" in _INLINE_CODE.sub("", row)


def check_ledger(root: str, spec) -> tuple[list, list, dict]:
    violations, warnings, report = [], [], {}
    path = os.path.join(root, spec["path"])
    info = _read(path)
    if info is None:
        return violations, warnings, {"exists": False, "path": spec["path"]}
    text, _size, lines = info
    s, e = _ledger_region(lines, spec)
    region = lines[s:e]
    region_bytes = _bytes("\n".join(region))
    rows = list(_iter_table_rows(region))
    data_rows = [r for _i, r in rows]
    completed = [r for r in data_rows if _is_completed_row(r)]
    no_status = [r for r in data_rows
                 if not _is_completed_row(r) and not any(sym in r for sym in STATUS_SYMBOLS)]
    row_bytes = [_bytes(r) for r in data_rows] or [0]
    report.update({
        "path": spec["path"], "exists": True,
        "region": {"startLine": s + 1, "endLine": e, "lines": e - s},
        "bytes": region_bytes,
        "rows": len(data_rows),
        "items": len(data_rows) - len(completed),
        "completedRows": len(completed),
        "noStatusRows": len(no_status),
        "maxRowBytes": max(row_bytes),
    })
    # --- hard ---
    if spec.get("maxBytes") and region_bytes > spec["maxBytes"]:
        violations.append({
            "code": "ledger.bytes", "object": "ledger",
            "actual": region_bytes, "limit": spec["maxBytes"],
            "message": f"活账本 {region_bytes} B > 上限 {spec['maxBytes']} B（先按「投影」把已完成项移出）",
        })
    if spec.get("maxLines") and (e - s) > spec["maxLines"]:
        violations.append({
            "code": "ledger.lines", "object": "ledger",
            "actual": e - s, "limit": spec["maxLines"],
            "message": f"活账本区 {e - s} 行 > 上限 {spec['maxLines']} 行",
        })
    if spec.get("forbidCompleted") and completed:
        violations.append({
            "code": "ledger.completed_rows", "object": "ledger",
            "actual": len(completed), "limit": 0,
            "message": (f"活账本含 {len(completed)} 行 `~~` 已完成行 —— 违反「未完成投影」不变量；"
                        "应投影到 docs/archive/<name>-ledger-<YYYY-MM>.md 并从活表删除"),
        })
    # --- soft ---
    if spec.get("maxItems") and len(data_rows) - len(completed) > spec["maxItems"]:
        warnings.append({
            "code": "ledger.items", "object": "ledger",
            "actual": len(data_rows) - len(completed), "limit": spec["maxItems"],
            "message": f"活跃待办 {len(data_rows) - len(completed)} 条 > 建议 {spec['maxItems']} 条（该收敛）",
        })
    if spec.get("maxRowBytes") and max(row_bytes) > spec["maxRowBytes"]:
        warnings.append({
            "code": "ledger.row_bytes", "object": "ledger",
            "actual": max(row_bytes), "limit": spec["maxRowBytes"],
            "message": f"账本最长行 {max(row_bytes)} B > 建议 {spec['maxRowBytes']} B（超长移入 docs/，表内留指针）",
        })
    return violations, warnings, report


def check_addenda(root: str, spec) -> tuple[list, list, dict]:
    violations, warnings, report = [], [], {}
    path = os.path.join(root, spec["path"])
    info = _read(path)
    if info is None:
        return violations, warnings, {"exists": False}
    _text, _size, lines = info
    max_n = spec.get("maxPerSegment", 3)
    pat_date = re.compile(spec.get("datePattern") or r"^##\s+\d{4}-\d{2}-\d{2}")
    pat_base = re.compile(spec.get("basePattern") or r"第[\d一二三四五六七八九十百千零]+段")
    pat_n = re.compile(spec.get("countPattern") or r"补记\s*(\d+)")

    # 只从**段头**取，按 base（第N段）归组 —— 正文里出现的「补记N」是引用，不算补记
    groups: dict = {}
    order: list = []
    for ln in lines:
        if not pat_date.match(ln):
            continue
        bm = pat_base.search(ln)
        base = bm.group(0) if bm else ln.strip()[:40]
        nm = pat_n.search(ln)
        n = int(nm.group(1)) if nm else 0
        if base not in groups:
            groups[base] = {"base": base, "maxN": 0, "addenda": 0}
            order.append(base)
        g = groups[base]
        g["maxN"] = max(g["maxN"], n)
        if n:
            g["addenda"] += 1

    report["segments"] = len(order)
    report["maxSeen"] = max((groups[b]["maxN"] for b in order), default=0)
    if not order:
        warnings.append({
            "code": "addenda.not_measurable", "object": "addenda",
            "actual": 0, "limit": 0,
            "message": "段头格式未匹配任何日期段；补记上限无法校验（检查 addenda.basePattern / 段头格式）",
        })
        return violations, warnings, report

    offenders = [groups[b] for b in order if groups[b]["maxN"] > max_n]
    report["segmentsOverLimit"] = len(offenders)
    report["offenders"] = offenders[:20]
    if offenders:
        violations.append({
            "code": "addenda.per_segment", "object": "addenda",
            "actual": len(offenders), "limit": 0,
            "message": (f"{len(offenders)} 个段补记越限（最多 {report['maxSeen']} 条 > {max_n}）"
                        "—— 同日补记超 3 即开新段（E3 复发）"),
        })
    return violations, warnings, report


def check_archive(root: str, spec) -> tuple[list, list, dict]:
    violations, warnings, report = [], [], {"files": []}
    adir = os.path.join(root, spec.get("dir", "docs/archive"))
    if not os.path.isdir(adir):
        report["exists"] = False
        return violations, warnings, report
    report["exists"] = True
    lim = spec.get("maxFileBytes")
    for name in sorted(os.listdir(adir)):
        if not name.endswith(spec.get("globSuffix", ".md")):
            continue
        fp = os.path.join(adir, name)
        if not os.path.isfile(fp):
            continue
        size = os.path.getsize(fp)
        report["files"].append({"name": name, "bytes": size})
        if lim and size > lim:
            violations.append({
                "code": "archive.file_bytes", "object": name,
                "actual": size, "limit": lim,
                "message": f"{spec.get('dir')}/{name}: {size} B > 单片上限 {lim} B（应开新片）",
            })
    return violations, warnings, report


def check_segments(root: str, spec) -> tuple[list, list, dict]:
    violations, warnings, report = [], [], {}
    path = os.path.join(root, spec["path"])
    info = _read(path)
    if info is None:
        return violations, warnings, {"exists": False}
    _text, _size, lines = info
    starts = [ln for ln in lines if re.match(spec["match"], ln)]
    bad = [ln for ln in starts if not re.match(spec["expected"], ln)]
    report.update({"segments": len(starts), "malformedHeaders": len(bad)})
    if bad:
        warnings.append({
            "code": "segment.header_format", "object": "segments",
            "actual": len(bad), "limit": 0,
            "message": f"{len(bad)} 个段头不符格式 `## YYYY-MM-DD(第N段)…`",
        })
    return violations, warnings, report


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def run(root: str, cfg: dict) -> dict:
    V, W = [], []
    rep: dict = {"root": root}
    for fn, key in (
        (check_documents, "documents"),
        (check_ledger, "ledger"),
        (check_addenda, "addenda"),
        (check_archive, "archive"),
        (check_segments, "segmentHeader"),
    ):
        v, w, r = fn(root, cfg.get(key))
        V += v
        W += w
        rep[key] = r
    return {"ok": not V, "violations": V, "warnings": W, "report": rep}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="doc-protocol 体量闸（check-doc-budget）")
    ap.add_argument("--root", default=".", help="仓库根（默认 cwd）")
    ap.add_argument("--config", help="JSON 配置文件（覆盖默认预算）")
    ap.add_argument("--quiet", action="store_true", help="只输出 JSON，不打印人读摘要")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    # --config 缺省时自动发现 <root>/doc-budget.json —— 与 entrypoints 钩子的
    # loadBudgetConfig 行为对齐（钩子自动读），避免「闸忘了 --config 而误报全文红」。
    cfg = DEFAULTS
    cfg_path = args.config
    if not cfg_path:
        auto = os.path.join(root, "doc-budget.json")
        if os.path.isfile(auto):
            cfg_path = auto
    if cfg_path:
        try:
            with open(cfg_path, encoding="utf-8") as fh:
                cfg = _deep_merge(DEFAULTS, json.load(fh))
        except Exception as e:  # noqa: BLE001
            print(f"配置读取失败: {e}", file=sys.stderr)
            return 2

    result = run(root, cfg)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if not args.quiet:
        _print_summary(result)
    return 0 if result["ok"] else 1


def _print_summary(result: dict) -> None:
    r = result["report"]
    e = sys.stderr
    print("\n== check-doc-budget ==", file=e)
    print(f"  root: {r['root']}", file=e)
    for did, d in (r.get("documents") or {}).items():
        if not d.get("exists"):
            print(f"  [跳过] {did}: 不存在", file=e)
            continue
        extra = f" / {d['instructions']} 条指令" if "instructions" in d else ""
        print(f"  {did}: {d['lines']} 行 / {d['bytes']} B{extra}", file=e)
    lg = r.get("ledger") or {}
    if lg.get("exists"):
        print(f"  ledger: {lg['bytes']} B / {lg['rows']} 行 / {lg['items']} 活跃 / "
              f"{lg['completedRows']} 死行 / 最长行 {lg['maxRowBytes']} B", file=e)
    for v in result["violations"]:
        print(f"  🔴 {v['message']}", file=e)
    for w in result["warnings"]:
        print(f"  🟡 {w['message']}", file=e)
    if result["ok"]:
        print("  ✅ 全部在预算内" + ("（有 warning）" if result["warnings"] else ""), file=e)


if __name__ == "__main__":
    sys.exit(main())
