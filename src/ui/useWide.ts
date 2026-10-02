import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 800px)';

/** True on a laptop-size window: Project list and Cards side by side, popover menus. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
