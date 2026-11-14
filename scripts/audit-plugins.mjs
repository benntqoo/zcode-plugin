// 一次性审计脚本：按官方规范（zcode.z.ai/cn/docs/plugin + /docs/hooks + /docs/skill）
// 逐条检查 4 个插件 + marketplace.json。输出分级：ERROR（违规需修）/ WARN（合规但注意）/ ok。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || process.cwd();
let errors = 0, warns = 0;
const E = (m) => { errors++; console.log('  ERROR', m); };
const W = (m) => { warns++; console.log('  WARN ', m); };

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const CMDNAME_RE = /^[a-z0-9][a-z0-9_:-]{0,63}$/;
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'Stop'];
const PLUGIN_FIELDS = ['name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'commands', 'skills', 'hooks', 'mcpServers', 'agents', 'dependencies', 'userConfig'];
const CMD_FIELDS = ['description', 'argument-hint', 'allowed-tools', 'model', 'skills', 'disable-noninteractive'];
const SKILL_FIELDS = ['name', 'description', 'when_to_use', 'license', 'metadata'];

const fm = (p) => { const m = fs.readFileSync(p, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/); return m ? m[1] : null; };
const fmv = (front, key) => {
  const m = front?.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return undefined;
  if (!/^([>|][>|+-]?)?$/.test(m[1].trim())) return m[1].trim(); // 普通标量
  // YAML 块标量（>- 等）：收后续缩进行，按块标量折叠为单行 —— 长度检查才有意义
  const lines = front.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^${key}:[ \\t]*(?:[>|][>|+-]?)?[ \\t]*$`).test(l));
  if (start < 0) return m[1].trim();
  const body = [];
  for (let i = start + 1; i < lines.length && /^[ \t]/.test(lines[i]); i++) body.push(lines[i].replace(/^  /, ''));
  return body.join(' ').replace(/\s+/g, ' ').trim();
};

const market = JSON.parse(fs.readFileSync(path.join(ROOT, 'marketplace.json'), 'utf8'));
const marketByName = new Map(market.plugins.map((e) => [e.name, e]));

for (const mf of fs.readdirSync(path.join(ROOT, 'plugins'))) {
  const dir = path.join(ROOT, 'plugins', mf);
  if (!fs.existsSync(path.join(dir, '.zcode-plugin', 'plugin.json'))) continue;
  console.log(`\n== plugins/${mf} ==`);
  const m = JSON.parse(fs.readFileSync(path.join(dir, '.zcode-plugin', 'plugin.json'), 'utf8'));

  // A. manifest
  if (!NAME_RE.test(m.name)) E(`plugin.json name 不匹配规范正则: ${m.name}`);
  if (m.name !== mf) E(`manifest name(${m.name}) !== 目录名(${mf})`);
  if (!m.version) E('version 缺失（缺省 0.0.0，更新检测会失灵）');
  else if (!/^\d+\.\d+\.\d+/.test(m.version)) W(`version 非语义化: ${m.version}`);
  for (const k of Object.keys(m)) if (!PLUGIN_FIELDS.includes(k)) E(`plugin.json 未知字段: ${k}`);
  const me = marketByName.get(m.name);
  if (!me) E(`marketplace.json 缺少条目: ${m.name}`);
  else {
    if (me.version !== m.version) E(`版本不同步（更新检测口径）: marketplace=${me.version} vs manifest=${m.version}`);
    if (!fs.existsSync(path.resolve(ROOT, me.source ?? '.'))) E(`marketplace source 不可解析: ${me.source}`);
  }
  for (const [k, v] of Object.entries(m)) {
    if (['commands', 'skills', 'agents'].includes(k) && typeof v === 'string') {
      if (!fs.existsSync(path.join(dir, v))) E(`声明的 ${k} 目录不存在: ${v}`);
    }
    if (k === 'hooks' && typeof v === 'string') {
      const rel = v.replace(/^\.\//, '');
      if (rel === 'hooks/hooks.json') W('hooks 指向标准位置 hooks/hooks.json —— 规范：自动加载，manifest 重复声明会产生重复诊断（应删除该字段）');
      else console.log('  ok    hooks 指向非标准位置（保留声明）:', v);
    }
  }

  // B. hooks.json（标准位置）
  const hp = path.join(dir, 'hooks', 'hooks.json');
  if (fs.existsSync(hp)) {
    const h = JSON.parse(fs.readFileSync(hp, 'utf8'));
    for (const [ev, groups] of Object.entries(h.hooks ?? {})) {
      if (!EVENTS.includes(ev)) E(`未知事件: ${ev}`);
      for (const g of groups) {
        const mt = g.matcher;
        if (mt === undefined || mt === '' || mt === '*') console.log(`  ok    ${ev} 无 matcher=全部匹配`);
        else if (/^[\w|]+$/.test(mt)) {
          console.log(`  ok    ${ev} matcher 精确列表: ${mt}`);
          if (ev === 'SessionStart') {
            const bad = mt.split('|').filter((s) => !['startup', 'clear', 'compact'].includes(s));
            if (bad.length) W(`${ev} matcher 含规范未定义的 source: ${bad.join(',')}（永不触发，无实害；当前规范仅 startup/clear/compact）`);
          }
        } else { try { new RegExp(mt); console.log(`  ok    ${ev} matcher 合法正则: ${mt}`); } catch { E(`${ev} matcher 非法正则: ${mt}`); } }
        for (const h2 of g.hooks ?? []) {
          if (!['command', 'process'].includes(h2.type)) E(`${ev} 未知 type: ${h2.type}`);
          if (h2.type === 'process') {
            if (typeof h2.command !== 'string' || !Array.isArray(h2.args)) E(`${ev} process 需 command+args`);
            if (h2.timeoutMs !== undefined && typeof h2.timeoutMs !== 'number') E(`${ev} timeoutMs 必须是数字(ms)`);
            if (h2.timeout !== undefined && h2.timeoutMs !== undefined) W(`${ev} 同时有 timeout 与 timeoutMs（timeoutMs 优先，建议删 timeout）`);
          } else {
            if (typeof h2.command !== 'string') E(`${ev} command 需 shell 字符串`);
            if (h2.timeout !== undefined && typeof h2.timeout !== 'number') E(`${ev} timeout 必须是数字(秒)`);
          }
          if (h2.enabled === false) W(`${ev} 有 enabled:false 条目（runtime 跳过，确认非遗留）`);
        }
      }
    }
  }

  // C. commands/*.md
  const cdir = path.join(dir, m.commands ?? 'commands');
  if (fs.existsSync(cdir)) {
    for (const f of fs.readdirSync(cdir)) {
      if (!f.endsWith('.md')) continue;
      const base = f.slice(0, -3);
      if (!CMDNAME_RE.test(base)) E(`命令名不匹配规范正则: ${base}`);
      const front = fm(path.join(cdir, f));
      const body = fs.readFileSync(path.join(cdir, f), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
      if (!front) { if (!body) E(`命令 ${f} 无 frontmatter 且正文为空`); else W(`命令 ${f} 无 frontmatter（靠正文生效，规范允许）`); }
      else {
        const desc = fmv(front, 'description');
        if (!desc && !body) E(`命令 ${f} description 与正文均空`);
        for (const line of front.split('\n')) {
          const k = line.match(/^([a-zA-Z-]+):/)?.[1];
          if (k && !CMD_FIELDS.includes(k)) W(`命令 ${f} frontmatter 非白名单字段: ${k}（会被忽略）`);
        }
      }
    }
  }

  // D. skills/<name>/SKILL.md（单层目录）
  const sdir = path.join(dir, typeof m.skills === 'string' ? m.skills : 'skills');
  if (fs.existsSync(sdir)) {
    for (const s of fs.readdirSync(sdir)) {
      const sk = path.join(sdir, s);
      if (!fs.statSync(sk).isDirectory()) { E(`skills/ 下有散文件（规范只认 skills/<名>/SKILL.md 单层目录）: ${s}`); continue; }
      const sp = path.join(sk, 'SKILL.md');
      if (!fs.existsSync(sp)) { E(`技能目录缺 SKILL.md: ${s}`); continue; }
      const front = fm(sp);
      if (!front) { E(`SKILL.md 无 frontmatter: ${s}`); continue; }
      const name = fmv(front, 'name');
      const desc = fmv(front, 'description');
      if (!desc) E(`SKILL.md 缺 description（技能被忽略）: ${s}`);
      else if (desc.length > 1024) E(`SKILL.md description 超 1024 字符（整条丢弃！）: ${s} (${desc.length})`);
      else console.log(`  ok    skill ${name ?? s} description ${desc.length}/1024`);
      if (name && name !== s) W(`SKILL.md name(${name}) 与目录名(${s})不一致（以谁为准取决于实现，建议一致）`);
      for (const line of front.split('\n')) {
        const k = line.match(/^([a-zA-Z_-]+):/)?.[1];
        if (k && !SKILL_FIELDS.includes(k)) console.log(`  ok    SKILL.md 非白名单字段（忽略无害）: ${k}`);
      }
    }
  }
}

// E. marketplace.json 顶层
console.log('\n== marketplace.json ==');
if (!NAME_RE.test(market.name)) E(`marketplace name 不匹配规范: ${market.name}`);
if (!Array.isArray(market.plugins)) E('plugins 缺失或非数组');
for (const k of Object.keys(market)) if (!['name', 'description', 'plugins', 'pluginRoot', 'allowCrossMarketplaceDependenciesOn'].includes(k)) W(`顶层规范外字段: ${k}（规范未列出，疑似沿用 Claude 格式；未证据显示有害）`);
for (const e of market.plugins) {
  for (const k of Object.keys(e)) if (!['name', 'source', 'description', 'version', 'category', 'tags', 'dependencies', 'strict'].includes(k)) W(`条目 ${e.name} 规范外字段: ${k}`);
}

console.log(`\n== 结果: ${errors} ERROR / ${warns} WARN ==`);
process.exit(errors ? 1 : 0);
