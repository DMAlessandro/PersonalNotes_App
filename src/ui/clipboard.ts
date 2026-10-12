// ⋯ → Copy text (ticket 15): puts one Item's text on the device clipboard, laptop or phone.
import { useSync } from '../store/sync';

/** The async Clipboard API needs a secure context (Pages is HTTPS); the textarea fallback covers older browsers. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Copies the text and says so in the toast. */
export async function copyText(text: string): Promise<void> {
  const ok = await writeClipboard(text);
  useSync.setState({
    notice: ok
      ? { kind: 'info', text: 'Copied', at: Date.now() }
      : { kind: 'error', text: 'Could not copy: the browser blocked the clipboard', at: Date.now() },
  });
}
