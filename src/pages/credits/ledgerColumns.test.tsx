import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { contrastRatio } from '../../theme/contrast';
import { getModeTokens, resetThemeModeForTests, setThemeMode } from '../../theme/modes';
import { ledgerColumns } from './ledgerColumns';

afterEach(() => {
  localStorage.clear();
  resetThemeModeForTests();
});

type Line = Parameters<NonNullable<ReturnType<typeof ledgerColumns>[0]['render']>>[1];

const deltaCell = (delta: number): ReactElement => {
  const column = ledgerColumns<Line & { id: string }>((id) => id, {}, 'en-US', {
    withPurchase: false,
  })[0];
  const row = {
    id: '1',
    delta,
    reason: 'X',
    spendKind: null,
    featureKey: null,
    itemKey: null,
    quantity: null,
    note: null,
    createdAt: '2026-10-01T00:00:00Z',
  };
  return (column.render as (dom: null, row: unknown, i: number) => ReactElement)(null, row, 0);
};

describe('the change of a balance in the ledger', () => {
  it.each(['dim', 'deep', 'light'] as const)(
    'is written in the green and the red that can be read in the %s theme, and not coloured when it is 0',
    (mode) => {
      setThemeMode(mode);
      const tokens = getModeTokens(mode);
      const { unmount } = render(deltaCell(5));
      expect(screen.getByTestId('delta')).toHaveStyle({ color: tokens.colorRiseText });
      expect(contrastRatio(tokens.colorRiseText, tokens.colorBgContainer)).toBeGreaterThanOrEqual(
        4.5,
      );
      unmount();
      const minus = render(deltaCell(-5));
      expect(screen.getByTestId('delta')).toHaveStyle({ color: tokens.colorFallText });
      expect(contrastRatio(tokens.colorFallText, tokens.colorBgContainer)).toBeGreaterThanOrEqual(
        4.5,
      );
      minus.unmount();
      render(deltaCell(0));
      expect(screen.getByTestId('delta').getAttribute('style')).toBeNull();
    },
  );
});
