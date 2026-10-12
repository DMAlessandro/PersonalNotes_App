// Adds the Claude Sessions bridge hooks to ~/.claude/settings.json (all folders), keeping every other hook.
// Makes a backup first, and removes this folder's local copy so the hooks don't run twice here.
//   node install-global.mjs            install
//   node install-global.mjs --remove   uninstall
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const settingsPath = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'settings.json');
const hook = join(here, 'hook.mjs').replace(/\\/g, '/');
const deliver = join(here, 'deliver.mjs').replace(/\\/g, '/');
const remove = process.argv.includes('--remove');

// hook.mjs: tags + queueing (fast). deliver.mjs --wait: background waiter for a phone answer, wakes the
// session when one arrives (asyncRewake); it gives up after config.json "waitMinutes" (default 55).
const ours = {
  UserPromptSubmit: [{ type: 'command', command: `node "${hook}"`, timeout: 10 }],
  Stop: [
    { type: 'command', command: `node "${hook}"`, timeout: 10 },
    { type: 'command', command: `node "${deliver}" --wait`, asyncRewake: true, timeout: 3600 },
  ],
};

const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
copyFileSync(settingsPath, `${settingsPath}.bak-phone-bridge`);
s.hooks ??= {};
for (const [ev, hooks] of Object.entries(ours)) {
  const kept = (s.hooks[ev] ?? []).filter((e) => !JSON.stringify(e).includes('phone-bridge-test'));
  s.hooks[ev] = remove ? kept : [...kept, { hooks }];
  if (!s.hooks[ev].length) delete s.hooks[ev];
}
writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');

const local = join(here, '.claude', 'settings.local.json');
if (!remove && existsSync(local)) rmSync(join(here, '.claude'), { recursive: true });

console.log(`${remove ? 'Removed the bridge hooks from' : 'Installed the bridge hooks in'} ${settingsPath}`);
console.log(`Backup: ${settingsPath}.bak-phone-bridge`);
console.log('New Claude sessions pick this up; sessions already open keep their old hooks.');
