// Builds the Claude Sessions bridge (ticket 16) into a folder of your choice:
//   node scripts/build-bridge.mjs <folder>
// Writes <folder>/deliver.mjs (bundled, no dependencies), hook.mjs and install-global.mjs. Keeps config.json, queue/ and data/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'rolldown';

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/build-bridge.mjs <folder>');
mkdirSync(out, { recursive: true });
await build({
  input: resolve('bridge/cli.ts'),
  platform: 'node',
  output: { file: join(out, 'deliver.mjs'), format: 'esm' },
});
for (const f of ['hook.mjs', 'install-global.mjs']) copyFileSync(resolve('bridge', f), join(out, f));
console.log(`bridge built into ${out}`);
