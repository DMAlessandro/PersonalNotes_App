import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from './App';

describe('App shell', () => {
  it('shows the top bar with the unpushed badge and the GitHub set-up button', () => {
    const html = renderToString(<App />);
    expect(html).toContain('All Projects');
    expect(html).toMatch(/class="badge"[^>]*>0<span[^>]*> unpushed<\/span>/);
    expect(html).toMatch(/Set up<span[^>]*> GitHub<\/span>/);
  });
});
