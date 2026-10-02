import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { useUpdate } from './store/update';
import './styles.css';

const updateSW = registerSW({
  onNeedRefresh: () => useUpdate.setState({ ready: true, apply: () => void updateSW(true) }),
  onRegisteredSW: (_url, reg) => {
    if (!reg) return;
    // Look for a new version whenever the app is opened again or comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
