import { useEffect, useState } from 'react';
import { useEscape } from './useEscape';
import { GitHubClient, GitHubError } from '../github/client';
import { deviceName, setDeviceName } from '../store/device';
import { loadSettings, loadToken, saveSettings, saveToken, type GitHubSettings } from '../store/settings';
import { isConfigured, useSync } from '../store/sync';
import { shortDate } from './format';

const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new';

type Persist = 'granted' | 'not granted' | 'unsupported' | 'checking';

async function persistState(): Promise<Persist> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'granted' : 'not granted';
}

/** Ask the browser to keep this app's data even when space runs low (spec §6.4: protects unpushed work). */
export async function askPersistence(): Promise<Persist> {
  if (!navigator.storage?.persist) return 'unsupported';
  return (await navigator.storage.persist()) ? 'granted' : 'not granted';
}

/** Spec §5.7 Settings, which is also the first-run set-up (§5.8) when GitHub isn't configured yet. */
export function Settings({ onClose }: { onClose: () => void }) {
  useEscape(onClose);
  const saved = loadSettings();
  const savedToken = loadToken();
  const [device, setDevice] = useState(deviceName());
  const [gh, setGh] = useState<GitHubSettings>(saved);
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(!savedToken);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [persist, setPersist] = useState<Persist>('checking');
  const { lastPulled, busy, pullNow, settingsChanged } = useSync();
  const firstRun = !isConfigured();

  useEffect(() => {
    void persistState().then(setPersist);
  }, []);

  const tokenToUse = replacing ? token.trim() : (savedToken ?? '');
  const complete = !!(gh.owner.trim() && gh.repo.trim() && tokenToUse);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const r = await new GitHubClient({ ...gh, token: tokenToUse }).checkAccess();
      if (!r.canPush) setTest({ ok: false, text: 'Connected, but this token cannot write. Give it Contents: Read and write.' });
      else setTest({ ok: true, text: `Connected to ${gh.owner}/${gh.repo}${r.private ? ' (private)' : ' — warning: this repo is public'}.` });
    } catch (e) {
      setTest({ ok: false, text: e instanceof GitHubError ? e.message : 'Could not reach GitHub.' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setDeviceName(device.trim() || deviceName());
    const repoChanged = saved.owner !== gh.owner.trim() || saved.repo !== gh.repo.trim() || saved.branch !== (gh.branch.trim() || 'main');
    saveSettings(gh);
    if (replacing && token.trim()) saveToken(token);
    await settingsChanged(repoChanged);
    if (firstRun && isConfigured()) setPersist(await askPersistence());
    onClose();
    void pullNow();
  };

  const forget = async () => {
    saveToken(null);
    setReplacing(true);
    setToken('');
    await settingsChanged(false);
  };

  return (
    <div className="log-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="log settings" aria-label="Settings">
        <header className="log-header">
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ←
          </button>
          <h2>{firstRun ? 'Set up GitHub' : 'Settings'}</h2>
        </header>
        <div className="log-body">
          {firstRun && (
            <p className="intro">
              Your notes are saved on this device as you type. To have them on your other device too, connect your private
              GitHub repo: nothing leaves this device until you press <b>Push</b>.
            </p>
          )}

          <section className="set">
            <h3 className="log-week">This device</h3>
            <label className="set-row">
              <span>Device name</span>
              <input className="field" value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Laptop" />
            </label>
            <p className="hint">Shown in the Change log and in each commit message.</p>
          </section>

          <section className="set">
            <h3 className="log-week">GitHub</h3>
            <label className="set-row">
              <span>Owner</span>
              <input
                className="field"
                value={gh.owner}
                onChange={(e) => setGh({ ...gh, owner: e.target.value })}
                placeholder="your GitHub username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="set-row">
              <span>Repo</span>
              <input className="field" value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="set-row">
              <span>Branch</span>
              <input className="field" value={gh.branch} onChange={(e) => setGh({ ...gh, branch: e.target.value })} autoCapitalize="none" spellCheck={false} />
            </label>
            {replacing ? (
              <label className="set-row">
                <span>Token</span>
                <input
                  className="field"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ) : (
              <div className="set-row">
                <span>Token</span>
                <span className="token-saved">
                  Saved on this device (…{savedToken?.slice(-4)})
                  <button className="secondary small" onClick={() => setReplacing(true)}>
                    Replace
                  </button>
                  <button className="secondary small danger-text" onClick={forget}>
                    Forget
                  </button>
                </span>
              </div>
            )}
            <p className="hint">
              Make a <b>fine-grained</b> token on{' '}
              <a href={TOKEN_PAGE} target="_blank" rel="noopener noreferrer">
                GitHub's token page
              </a>
              : Repository access → <i>Only select repositories</i> → <code>{gh.repo || 'PersonalNotes'}</code>; Permissions →{' '}
              <i>Contents: Read and write</i>. The token stays in this browser on this device.
            </p>
            <div className="actions">
              <button className="secondary" disabled={!complete || testing} onClick={runTest}>
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>
            {test && <p className={test.ok ? 'test ok' : 'test bad'}>{test.text}</p>}
          </section>

          <section className="set">
            <h3 className="log-week">Storage</h3>
            <p className="hint hint-row">
              Keep data even when the device runs low on space: <b>{persist}</b>
              {persist === 'not granted' && (
                <button className="secondary small" onClick={async () => setPersist(await askPersistence())}>
                  Ask again
                </button>
              )}
            </p>
            {!firstRun && (
              <p className="hint hint-row">
                Last pulled: {lastPulled ? `${shortDate(lastPulled)}, ${lastPulled.slice(11, 16)}` : 'not yet'}{' '}
                <button className="secondary small" disabled={!!busy} onClick={() => void pullNow()}>
                  {busy === 'pull' ? 'Pulling…' : 'Pull now'}
                </button>
              </p>
            )}
          </section>

          <div className="actions sticky-actions">
            <span className="hint">Version {__APP_VERSION__}</span>
            <span className="spacer" />
            <button className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
