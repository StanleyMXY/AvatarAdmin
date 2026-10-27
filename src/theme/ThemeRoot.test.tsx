import { act, render, screen } from '@testing-library/react';
import { App, Button } from 'antd';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetThemeModeForTests, setThemeMode } from './modes';
import { ThemeRoot } from './ThemeRoot';

beforeEach(() => {
  resetThemeModeForTests();
});

function Probe() {
  const { modal } = App.useApp();
  return (
    <button type="button" onClick={() => modal.confirm({ title: 'Delete?' })}>
      ask
    </button>
  );
}

describe('ThemeRoot', () => {
  it('lets a page use App.useApp().modal, which follows the theme', async () => {
    render(
      <ThemeRoot>
        <Probe />
      </ThemeRoot>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'ask' }).click();
    });
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete?');
  });

  it('draws the dialog opened from App.useApp() with the same theme as the page', async () => {
    act(() => setThemeMode('light'));
    render(
      <ThemeRoot>
        <Button>page</Button>
        <Probe />
      </ThemeRoot>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'ask' }).click();
    });
    await screen.findByRole('dialog');
    const themeClass = (el: Element | null) =>
      [...(el?.classList ?? [])].filter((c) => /^css-var-|^css-[a-z0-9]+$/.test(c)).sort();
    const page = themeClass(screen.getByRole('button', { name: 'page' }));
    const dialog = themeClass(document.querySelector('.ant-modal-root'));
    expect(dialog.length).toBeGreaterThan(0);
    expect(dialog.filter((c) => c.startsWith('css-var-'))).toEqual(
      page.filter((c) => c.startsWith('css-var-')),
    );
  });

  it('marks the document with the mode and changes it in place', () => {
    render(
      <ThemeRoot>
        <span>x</span>
      </ThemeRoot>,
    );
    expect(document.documentElement.dataset.theme).toBe('dim');
    act(() => setThemeMode('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
