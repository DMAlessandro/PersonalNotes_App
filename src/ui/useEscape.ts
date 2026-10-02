import { useEffect } from 'react';

/**
 * Esc closes a full side panel (Change log, Settings, Search, Workspaces) on a laptop. Not while a menu or
 * confirmation is open on top (that closes first), and not when a text field already used the key.
 */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.backdrop')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
