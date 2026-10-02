// Spec §5.7: GitHub settings and the token, per device, in this browser's local storage (ticket 08:
// protected by the device lock, no passphrase). Never sent anywhere but api.github.com.

export type GitHubSettings = { owner: string; repo: string; branch: string };

const SETTINGS = 'pn.github';
const TOKEN = 'pn.token';

export const defaultSettings = (): GitHubSettings => ({ owner: '', repo: 'PersonalNotes', branch: 'main' });

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: the settings simply won't be remembered
  }
}

export function loadSettings(): GitHubSettings {
  try {
    return { ...defaultSettings(), ...(JSON.parse(read(SETTINGS) ?? '{}') as Partial<GitHubSettings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: GitHubSettings) {
  write(SETTINGS, JSON.stringify({ owner: s.owner.trim(), repo: s.repo.trim(), branch: s.branch.trim() || 'main' }));
}

export const loadToken = () => read(TOKEN);
export const saveToken = (t: string | null) => write(TOKEN, t ? t.trim() : null);
