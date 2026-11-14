// Bridge between ZCode's PostToolUse hook and the vendored impeccable engine.
// ZCode delivers a Claude-style snake_case envelope (hook_event_name /
// tool_name / tool_input), which the engine's harness detection treats as its
// "claude" fallback — so no IMPECCABLE_HOOK_HARNESS is needed here. The
// envelope itself is relayed on stdin: the engine's `hook` verb reads the
// touched file from it.
//
// Launcher order on win32: `sh` first (the bash launcher is upstream's tested
// path and ZCode's shell is Git Bash), then `cmd /c impeccable.cmd` (upstream
// ships it but notes it is not yet exercised on a real Windows machine). Any
// failure exits non-zero like upstream's own hooks — the engine's message is
// self-explanatory (e.g. first-run engine download).
//
// Gotchas baked in (both reproduced on win32 + Git Bash, 2026-11-14):
// - MSYS sh must receive a forward-slash path: a backslash path makes the
//   bash launcher mis-resolve its own dir and hunt for the engine in the
//   repo root (exit 127, wrong bin search, empty VERSION).
// - Child stdout/stderr use `inherit`, not manual piping: manual 'data' relay
//   can lose output when process.exit() races pending async writes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptDir = path.join(pluginRoot, 'skills', 'impeccable', 'scripts');
const posix = (p) => p.split(path.sep).join('/');

function run(cmd, args, stdinText) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve({ code }));
    child.stdin.end(stdinText);
  });
}

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const stdinText = Buffer.concat(chunks);

// Each attempt: [command, argv, launcherPath] — launcherPath is checked for
// existence up front. Keep it explicit: the launcher sits at different argv
// indexes per command (argv[0] for sh, argv[1] after /c for cmd.exe).
const shLauncher = posix(path.join(scriptDir, 'impeccable'));
const cmdLauncher = path.join(scriptDir, 'impeccable.cmd');
const attempts =
  process.platform === 'win32'
    ? [
        ['sh', [shLauncher, 'hook'], shLauncher],
        ['cmd.exe', ['/c', cmdLauncher, 'hook'], cmdLauncher],
      ]
    : [['sh', [shLauncher, 'hook'], shLauncher]];

for (const [cmd, args, launcherPath] of attempts) {
  if (!fs.existsSync(launcherPath)) continue; // launcher missing: nothing to run
  const result = await run(cmd, args, stdinText);
  if (result !== null) process.exit(result.code ?? 0);
  // spawn failed (e.g. sh not on PATH in the hook's environment): try next
}
process.exit(0);
