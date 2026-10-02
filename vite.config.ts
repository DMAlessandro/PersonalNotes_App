/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// Spec §7: the token lives on this origin, so the built app only talks to itself and api.github.com.
// Production only: the dev server injects inline scripts that this policy would block.
const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.github.com",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const csp: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig({
  base: '/PersonalNotes_App/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    csp,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'PersonalNote',
        short_name: 'PersonalNote',
        description: 'Personal notes and tasks, stored in your own GitHub repo.',
        theme_color: '#2f6fde',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/PersonalNotes_App/',
        scope: '/PersonalNotes_App/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
