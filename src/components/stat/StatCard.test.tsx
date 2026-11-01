import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { contrastRatio } from '../../theme/contrast';
import { getModeTokens, resetThemeModeForTests, setThemeMode } from '../../theme/modes';
import { StatCard } from './StatCard';

afterEach(() => {
  localStorage.clear();
  resetThemeModeForTests();
});

const card = (
  props: Partial<React.ComponentProps<typeof StatCard>> = {},
  locale: 'en-US' | 'zh-CN' = 'en-US',
) =>
  renderPage(
    <StatCard title="DAU" value={1200} previous={1000} previousLabel="vs yesterday" {...props} />,
    locale,
  );

describe('StatCard', () => {
  it('shows a rise in green with a plus sign', () => {
    card();
    expect(screen.getByTestId('stat-value')).toHaveTextContent('1,200');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('+20%');
    expect(screen.getByTestId('stat-change')).toHaveStyle({
      color: getModeTokens('dim').colorRiseText,
    });
  });

  it('shows a fall in red', () => {
    card({ value: 800 });
    expect(screen.getByTestId('stat-change')).toHaveTextContent('-20%');
    expect(screen.getByTestId('stat-change')).toHaveStyle({
      color: getModeTokens('dim').colorFallText,
    });
  });

  it('writes the change in a green and a red that can be read (4.5:1) on the light page too, not the pale chart colours', () => {
    setThemeMode('light');
    const { unmount } = card();
    const tokens = getModeTokens('light');
    const rise = screen.getByTestId('stat-change');
    expect(rise).toHaveStyle({ color: tokens.colorRiseText });
    expect(contrastRatio(tokens.colorRiseText, tokens.colorBgContainer)).toBeGreaterThanOrEqual(
      4.5,
    );
    unmount();
    card({ value: 800 });
    expect(screen.getByTestId('stat-change')).toHaveStyle({ color: tokens.colorFallText });
    expect(contrastRatio(tokens.colorFallText, tokens.colorBgContainer)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('shows no colour and no sign for no change', () => {
    card({ value: 1000 });
    expect(screen.getByTestId('stat-change')).toHaveTextContent('0%');
    expect(screen.getByTestId('stat-change').getAttribute('style')).toBeNull();
  });

  it.each([null, 0, undefined])(
    'shows a dash for the change when the previous value is %s',
    (previous) => {
      card({ previous });
      expect(screen.getByTestId('stat-change')).toHaveTextContent('—');
      expect(screen.getByTestId('stat-change').textContent).not.toMatch(/NaN|Infinity/);
    },
  );

  it('shows a dash for a value that is null, and for the change', () => {
    card({ value: null });
    expect(screen.getByTestId('stat-value')).toHaveTextContent('—');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('—');
  });

  it('shows a percentage value, and the change as a relative percentage', () => {
    card({ unit: 'percent', value: 0.3, previous: 0.25 });
    expect(screen.getByTestId('stat-value')).toHaveTextContent('30%');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('+20%');
  });

  it('shows the change of a percentage point card as percentage points, not as percent', () => {
    card({ unit: 'percentPoint', value: 0.3, previous: 0.25 });
    expect(screen.getByTestId('stat-value')).toHaveTextContent('30%');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('+5 pp');
    expect(screen.getByTestId('stat-change').textContent).not.toContain('%');
  });

  it('says "percentage points" in Chinese', () => {
    card({ unit: 'percentPoint', value: 0.3, previous: 0.25 }, 'zh-CN');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('+5 个百分点');
  });

  it('shows a value of zero as 0, not as a dash', () => {
    card({ value: 0, previous: 5 });
    expect(screen.getByTestId('stat-value')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-change')).toHaveTextContent('-100%');
  });
});
