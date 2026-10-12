// Claude Sessions bridge, the hook (ticket 16). Registered as both the UserPromptSubmit and the Stop hook.
//   #phoneon    -> every reply of this session goes to the app, until #phoneoff
//   #phoneoff   -> stop
//   #phone      -> only the next reply
// A flagged reply is queued (queue/*.json) and deliver.mjs is started in the background, so Claude never
// waits for GitHub. Plain JS, no dependencies: copied next to deliver.mjs by scripts/build-bridge.mjs.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATE = join(ROOT, 'data', 'state');
const QUEUE = join(ROOT, 'queue');
const LOG = join(ROOT, 'data', 'bridge.log');
const TAG = /(?:^|\s)#phone(on|off)?(?=\s|$|[.,;:!?])/gi;

const log = (line) => {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, `${new Date().toISOString()} hook    ${line}\n`);
  } catch {}
};

/** "PersonalNote_App · 12 Oct 17:37": the name of the session's Task in the app. */
const sessionTitle = (cwd) => {
  const when = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  return `${basename(cwd || 'Claude')} · ${when}`;
};

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {}

try {
  const input = JSON.parse(raw);
  const sid = String(input.session_id || 'unknown');
  const statePath = join(STATE, `${sid}.json`);
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { mode: 'off' };
  const save = (s) => {
    mkdirSync(STATE, { recursive: true });
    writeFileSync(statePath, JSON.stringify(s));
  };

  if (input.hook_event_name === 'UserPromptSubmit') {
    const tags = [...String(input.prompt || '').matchAll(TAG)];
    if (tags.length) {
      const last = (tags[tags.length - 1][1] || '').toLowerCase();
      const mode = last === 'on' ? 'on' : last === 'off' ? 'off' : 'once';
      save({ ...state, mode, title: state.title || sessionTitle(input.cwd) });
      log(`${sid.slice(0, 8)} -> ${mode}`);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            'The "#phone"/"#phoneon"/"#phoneoff" tag in this prompt is a signal for a local hook (it forwards your reply to the user\'s phone). Ignore the tag and answer the rest of the prompt normally.',
        },
      }));
    }
  } else if (input.hook_event_name === 'Stop' && (state.mode === 'on' || state.mode === 'once')) {
    const text = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : '';
    if (text.trim()) {
      mkdirSync(QUEUE, { recursive: true });
      const name = `${Date.now()}-${randomBytes(3).toString('hex')}.json`;
      writeFileSync(join(QUEUE, name), JSON.stringify({ sid, title: state.title || sessionTitle(input.cwd), text }));
      log(`${sid.slice(0, 8)} queued ${text.length} chars`);
      spawn(process.execPath, [join(ROOT, 'deliver.mjs')], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
    if (state.mode === 'once') save({ ...state, mode: 'off' });
  }
} catch (e) {
  log(`error ${e && e.message}`);
}
process.exit(0);
